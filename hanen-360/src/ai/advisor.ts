import type Anthropic from '@anthropic-ai/sdk';
import type { Env, User } from '../env';
import { agentById, systemPrompt, type AgentDef } from './agents';
import { TOOLS } from './tools';
import { aiErrorMessage, createMessage, model } from './client';
import { runJob } from '../jobs/runner';
import { getSettings } from '../lib/settings';

type Msg = Anthropic.Beta.BetaMessageParam;
const MAX_ITER = 10;

function toolsFor(agent: AgentDef): Anthropic.Tool[] {
  return agent.tools.filter((t) => TOOLS[t]).map((t) => TOOLS[t].def);
}

/** Executes tool calls in parallel; each runs as a tracked job attributed to its specialist. */
async function execTools(env: Env, user: User, agent: AgentDef, blocks: Anthropic.Beta.BetaToolUseBlock[], conversationId: number | null) {
  return Promise.all(blocks.map(async (b) => {
    const tool = TOOLS[b.name];
    if (!tool || !agent.tools.includes(b.name)) {
      return { type: 'tool_result' as const, tool_use_id: b.id, is_error: true, content: `Outil non autorisé pour ${agent.id}: ${b.name}` };
    }
    const input = (b.input && typeof b.input === 'object' ? b.input : {}) as Record<string, any>;
    const owner = agent.id === 'director' ? tool.owner : agent.id;
    const r = await runJob(env, `ai_tool:${b.name}`, owner, `user:${user.email}`, { input, conversation_id: conversationId }, () => tool.run(env, input, { user, agent: owner }));
    return r.ok
      ? { type: 'tool_result' as const, tool_use_id: b.id, content: JSON.stringify(r.output ?? null).slice(0, 60_000) }
      : { type: 'tool_result' as const, tool_use_id: b.id, is_error: true, content: r.error ?? 'erreur' };
  }));
}

export interface LoopResult { text: string; tools_used: string[]; appended: { role: 'user' | 'assistant'; content: unknown }[]; stop_reason: string | null }

/** Manual agentic loop: we own permissions, job tracking and persistence of every turn. */
export async function agentLoop(env: Env, user: User, agent: AgentDef, history: Msg[], conversationId: number | null): Promise<LoopResult> {
  const s = await getSettings(env);
  const system = [{ type: 'text' as const, text: systemPrompt(agent, s.company_name), cache_control: { type: 'ephemeral' as const } }];
  const tools = toolsFor(agent);
  const messages: Msg[] = [...history];
  const appended: LoopResult['appended'] = [];
  const used: string[] = [];
  for (let i = 0; i < MAX_ITER; i++) {
    const resp = await createMessage(env, {
      model: model(env), max_tokens: 16000, system, tools, messages,
      thinking: { type: 'adaptive' }, output_config: { effort: 'high' },
    });
    messages.push({ role: 'assistant', content: resp.content as any });
    appended.push({ role: 'assistant', content: resp.content });
    if (resp.stop_reason === 'refusal') {
      return { text: 'La demande n’a pas pu être traitée par le service IA (refus de sécurité). Reformulez la question en termes économiques.', tools_used: used, appended, stop_reason: 'refusal' };
    }
    if (resp.stop_reason === 'pause_turn') continue;
    const calls = resp.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (resp.stop_reason !== 'tool_use' || !calls.length) {
      const text = resp.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { text: text || (resp.stop_reason === 'max_tokens' ? 'Réponse tronquée (limite de longueur).' : ''), tools_used: used, appended, stop_reason: resp.stop_reason };
    }
    used.push(...calls.map((c) => c.name));
    const results = await execTools(env, user, agent, calls, conversationId);
    messages.push({ role: 'user', content: results });
    appended.push({ role: 'user', content: results });
  }
  return { text: 'Analyse interrompue : trop d’étapes. Précisez la question.', tools_used: used, appended, stop_reason: 'max_iterations' };
}

export async function chat(env: Env, user: User, conversationId: number | null, message: string, agentId = 'director') {
  const agent = agentById(agentId);
  if (!agent) throw new Error('Agent inconnu');
  let convId = conversationId;
  if (convId) {
    const c = await env.DB.prepare('SELECT id, user_id FROM h360_ai_conversations WHERE id=?').bind(convId).first<any>();
    if (!c || c.user_id !== user.id) throw new Error('Conversation introuvable');
  } else {
    const r = await env.DB.prepare('INSERT INTO h360_ai_conversations (user_id, title, agent) VALUES (?,?,?)').bind(user.id, message.slice(0, 80), agent.id).run();
    convId = Number(r.meta.last_row_id);
  }
  const rows = (await env.DB.prepare('SELECT role, content_json FROM h360_ai_messages WHERE conversation_id=? ORDER BY id').bind(convId).all<any>()).results;
  if (rows.length > 80) throw new Error('Conversation trop longue : démarrez une nouvelle conversation');
  const history: Msg[] = rows.map((r) => ({ role: r.role, content: JSON.parse(r.content_json) }));
  const userMsg: Msg = { role: 'user', content: [{ type: 'text', text: message }] };
  history.push(userMsg);

  const result = await runJob(env, 'ai_chat', agent.id, `user:${user.email}`, { conversation_id: convId, chars: message.length }, () => agentLoop(env, user, agent, history, convId).catch((e) => { throw new Error(aiErrorMessage(e)); }));
  if (!result.ok || !result.output) throw new Error(result.error || 'Échec de l’analyse IA');
  const out = result.output;
  // Persist append-only: user message, then every assistant/tool turn verbatim.
  const stmts = [env.DB.prepare('INSERT INTO h360_ai_messages (conversation_id, role, content_json, display_text) VALUES (?,?,?,?)').bind(convId, 'user', JSON.stringify(userMsg.content), message)];
  out.appended.forEach((m, idx) => {
    const last = idx === out.appended.length - 1;
    stmts.push(env.DB.prepare('INSERT INTO h360_ai_messages (conversation_id, role, content_json, display_text, tools_used) VALUES (?,?,?,?,?)')
      .bind(convId, m.role, JSON.stringify(m.content), last ? out.text : null, last ? JSON.stringify([...new Set(out.tools_used)]) : null));
  });
  stmts.push(env.DB.prepare("UPDATE h360_ai_conversations SET updated_at=datetime('now') WHERE id=?").bind(convId));
  await env.DB.batch(stmts);
  return { conversation_id: convId, text: out.text, tools_used: [...new Set(out.tools_used)], job_id: result.job_id };
}

/** One specialist runs a focused analysis and records its recommendations for approval. */
export async function runSpecialist(env: Env, user: User, agentId: string, focus: string) {
  const agent = agentById(agentId);
  if (!agent || agent.id === 'director') throw new Error('Spécialiste inconnu');
  const prompt = `Run your standard analysis${focus ? ` with this focus: ${focus}` : ''}. Use your tools, then record each quantified recommendation with propose_recommendation (maximum 3). Finish with a short executive summary in French.`;
  return runJob(env, 'agent_analysis', agent.id, `user:${user.email}`, { focus }, async () => {
    const r = await agentLoop(env, user, agent, [{ role: 'user', content: prompt }], null).catch((e) => { throw new Error(aiErrorMessage(e)); });
    return { summary: r.text, tools_used: [...new Set(r.tools_used)] };
  });
}
