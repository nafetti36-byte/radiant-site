import type { Router } from '../router';
import { HttpError, json, readJson } from '../lib/http';
import { require as requirePerm } from '../lib/auth';
import { auditCtx } from '../lib/audit';
import { AGENTS, DIRECTOR } from '../ai/agents';
import { TOOLS } from '../ai/tools';
import { aiConfigured, aiErrorMessage, model } from '../ai/client';
import { chat, runSpecialist } from '../ai/advisor';
import { answer, INTENTS } from '../engine/assistant';
import { upsertRecommendation } from '../engine/recommend';
import { runJob } from '../jobs/runner';

const INTENT_AGENT: Record<string, string> = { max_price: 'recovered_paper_analyst', best_supplier: 'procurement_analyst', cost_increase: 'manufacturing_cost_engineer', price_change: 'pricing_strategist', pulp_drop: 'recovered_paper_analyst', savings: 'financial_controller', buy_now: 'virgin_pulp_market' };

export function aiRoutes(r: Router) {
  // ── Free built-in assistant (no external AI, no cost)
  r.post('/api/assistant', async (c) => {
    const u = requirePerm(c, 'read');
    const b = await readJson<any>(c.req);
    if (!(INTENTS as readonly string[]).includes(b.intent)) throw new HttpError(422, 'Question inconnue');
    const res = await runJob(c.env, `assistant:${b.intent}`, INTENT_AGENT[b.intent], `user:${u.email}`, b.params ?? {}, () => answer(c.env, b.intent, b.params ?? {}, b.lang));
    if (!res.ok) throw new HttpError(500, res.error || 'Erreur');
    return json(res.output);
  });
  r.post('/api/assistant/propose', async (c) => {
    const u = requirePerm(c, 'write');
    const b = await readJson<any>(c.req);
    if (!(INTENTS as readonly string[]).includes(b.intent)) throw new HttpError(422, 'Question inconnue');
    const a = await answer(c.env, b.intent, b.params ?? {}, 'fr'); // recomputed server-side, never trusted from the browser
    if (!a.sources.length) throw new HttpError(422, 'Données insuffisantes pour proposer une décision');
    const rec = await upsertRecommendation(c.env, {
      slot: `assistant:${a.intent}:${JSON.stringify(b.params ?? {})}`, module: a.module, type: `assistant_${a.intent}`, title: a.title, summary: a.verdict,
      reasoning: a.points.join('\n'), inputs: { sources: a.sources, params: b.params ?? {}, requested_by: u.email }, calc: { formula: a.formula ?? null, table: a.table ?? null },
      savings_tnd: a.savings_tnd ?? null, risks: a.missing.join(' ; ') || 'Validation qualité requise pour toute substitution', data_freshness: a.sources.slice(0, 4).join(' ; '),
      confidence: a.confidence, missing_info: a.missing.join(' ; ') || 'aucune', created_by: `assistant:${INTENT_AGENT[a.intent]}`,
    });
    await auditCtx(c, 'assistant.propose', 'recommendations', rec.id, { intent: a.intent });
    return json({ id: rec.id, created: rec.created });
  });

  r.get('/api/ai/status', async (c) => {
    requirePerm(c, 'read');
    const running = (await c.env.DB.prepare("SELECT agent, type, started_at FROM h360_jobs WHERE status='running' AND agent IS NOT NULL").all<any>()).results;
    const last = (await c.env.DB.prepare("SELECT agent, MAX(finished_at) last_run, SUM(CASE WHEN status='succeeded' THEN 1 ELSE 0 END) ok, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed FROM h360_jobs WHERE agent IS NOT NULL GROUP BY agent").all<any>()).results;
    const byAgent = Object.fromEntries(last.map((x: any) => [x.agent, x]));
    return json({
      configured: aiConfigured(c.env), model: model(c.env),
      connection: aiConfigured(c.env) ? 'connected' : 'Connexion requise',
      director: { ...DIRECTOR, tools: DIRECTOR.tools.map((t) => ({ name: t, description: TOOLS[t]?.def.description })) },
      agents: AGENTS.map((a) => ({ ...a, tools: a.tools.map((t) => ({ name: t, description: TOOLS[t]?.def.description, writes: t === 'propose_recommendation' })), active: running.filter((x: any) => x.agent === a.id).map((x: any) => ({ type: x.type, since: x.started_at })), stats: byAgent[a.id] ?? null })),
      guardrails: ['Aucun outil d’achat, d’envoi fournisseur, de signature, de publication de prix ou de dépense', 'Les recommandations entrent en statut « proposé » et attendent la décision de Hanen', 'Chaque appel d’outil est tracé comme tâche (journal Automatisation)'],
    });
  });

  r.get('/api/ai/conversations', async (c) => {
    const u = requirePerm(c, 'ai');
    return json((await c.env.DB.prepare('SELECT id, title, agent, created_at, updated_at FROM h360_ai_conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 50').bind(u.id).all()).results);
  });
  r.get('/api/ai/conversations/:id', async (c) => {
    const u = requirePerm(c, 'ai');
    const conv = await c.env.DB.prepare('SELECT * FROM h360_ai_conversations WHERE id=? AND user_id=?').bind(Number(c.params.id), u.id).first();
    if (!conv) throw new HttpError(404, 'Introuvable');
    const msgs = (await c.env.DB.prepare('SELECT id, role, display_text, tools_used, created_at FROM h360_ai_messages WHERE conversation_id=? AND display_text IS NOT NULL ORDER BY id').bind(Number(c.params.id)).all<any>()).results;
    return json({ conversation: conv, messages: msgs.map((m: any) => ({ ...m, tools_used: m.tools_used ? JSON.parse(m.tools_used) : [] })) });
  });
  r.del('/api/ai/conversations/:id', async (c) => {
    const u = requirePerm(c, 'ai');
    await c.env.DB.prepare('DELETE FROM h360_ai_messages WHERE conversation_id IN (SELECT id FROM h360_ai_conversations WHERE id=? AND user_id=?)').bind(Number(c.params.id), u.id).run();
    await c.env.DB.prepare('DELETE FROM h360_ai_conversations WHERE id=? AND user_id=?').bind(Number(c.params.id), u.id).run();
    return json({ ok: true });
  });

  r.post('/api/ai/chat', async (c) => {
    const u = requirePerm(c, 'ai');
    if (!aiConfigured(c.env)) throw new HttpError(503, 'Connexion requise : l’administrateur doit configurer le secret ANTHROPIC_API_KEY');
    const b = await readJson<any>(c.req);
    const msg = String(b.message || '').trim();
    if (!msg || msg.length > 4000) throw new HttpError(422, 'Question vide ou trop longue (4000 caractères max.)');
    try {
      const res = await chat(c.env, u, b.conversation_id ? Number(b.conversation_id) : null, msg, b.agent || 'director');
      await auditCtx(c, 'ai.chat', 'ai_conversations', res.conversation_id, { tools: res.tools_used });
      return json(res);
    } catch (e) {
      throw new HttpError(502, aiErrorMessage(e));
    }
  });

  r.post('/api/ai/agents/:id/run', async (c) => {
    const u = requirePerm(c, 'ai');
    if (!aiConfigured(c.env)) throw new HttpError(503, 'Connexion requise : ANTHROPIC_API_KEY');
    const b = await readJson<any>(c.req);
    const res = await runSpecialist(c.env, u, c.params.id, String(b.focus || '').slice(0, 1000)).catch((e) => { throw new HttpError(502, aiErrorMessage(e)); });
    await auditCtx(c, 'ai.agent_run', 'jobs', res.job_id, { agent: c.params.id });
    if (!res.ok) throw new HttpError(502, res.error || 'Échec');
    return json(res);
  });
}
