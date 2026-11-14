import type { Router } from '../router';
import type { Ctx } from '../env';
import { HttpError, assertValid, json, readJson, validate } from '../lib/http';
import { require as requirePerm } from '../lib/auth';
import { auditCtx } from '../lib/audit';
import { ENTITIES } from './entities';
import { runJob } from '../jobs/runner';
import { runEngineScan } from '../engine/recommend';
import { fibreAnalysis } from '../engine/data';
import { getSettings, num } from '../lib/settings';

const AUTO_ENTITIES = new Set(['offers', 'market_prices', 'production', 'fx_rates']);
/** Re-runs the recommendation/alert engine after every data change (no "Analyser" click needed). */
export function autoAnalyze(c: Ctx) {
  c.exec.waitUntil(runJob(c.env, 'auto_scan', 'procurement_analyst', `auto:${c.user?.email ?? 'system'}`, null, () => runEngineScan(c.env)));
}

const id = (c: Ctx) => { const n = Number(c.params.id); if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'id invalide'); return n; };

/** Filters accepted per entity (column → exact match), plus `q` free-text and date range. */
const FILTERS: Record<string, { eq: string[]; text: string[]; date?: string }> = {
  suppliers: { eq: ['active', 'country'], text: ['name', 'country', 'notes'] },
  offers: { eq: ['supplier_id', 'category', 'grade', 'status', 'validation_status', 'quality_status', 'currency'], text: ['grade', 'notes'], date: 'offer_date' },
  market_prices: { eq: ['grade', 'currency', 'source_type', 'validation_status'], text: ['grade', 'source', 'basis'], date: 'price_date' },
  fx_rates: { eq: ['currency', 'source_type'], text: ['source'], date: 'rate_date' },
  production: { eq: ['machine', 'product_grade', 'validation_status'], text: ['product_grade', 'notes'], date: 'period_end' },
  savings: { eq: ['status', 'category'], text: ['title', 'description', 'owner'] },
};

export async function listEntity(c: Ctx, name: string) {
  const spec = ENTITIES[name];
  const f = FILTERS[name];
  const where: string[] = [];
  const binds: unknown[] = [];
  for (const k of f.eq) { const v = c.url.searchParams.get(k); if (v !== null && v !== '') { where.push(`t.${k} = ?`); binds.push(v); } }
  const q = c.url.searchParams.get('q');
  if (q) { where.push('(' + f.text.map((k) => `t.${k} LIKE ?`).join(' OR ') + ')'); f.text.forEach(() => binds.push(`%${q}%`)); }
  if (f.date) {
    const from = c.url.searchParams.get('from'), to = c.url.searchParams.get('to');
    if (from) { where.push(`t.${f.date} >= ?`); binds.push(from); }
    if (to) { where.push(`t.${f.date} <= ?`); binds.push(to); }
  }
  const limit = Math.min(Number(c.url.searchParams.get('limit')) || 200, 1000);
  const join = name === 'offers' ? 'LEFT JOIN h360_suppliers s ON s.id = t.supplier_id' : '';
  const cols = name === 'offers' ? 't.*, s.name AS supplier_name' : 't.*';
  const sql = `SELECT ${cols} FROM ${spec.table} t ${join} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${spec.order.split(',').map((x) => 't.' + x.trim()).join(', ')} LIMIT ?`;
  return (await c.env.DB.prepare(sql).bind(...binds, limit).all<any>()).results.map(({ computed_json, ...r }: any) => r);
}

function entityRoutes(r: Router, name: string) {
  const spec = ENTITIES[name];
  r.get(`/api/${name}`, async (c) => { requirePerm(c, 'read'); return json(await listEntity(c, name)); });
  r.get(`/api/${name}/:id`, async (c) => {
    requirePerm(c, 'read');
    const row = await c.env.DB.prepare(`SELECT * FROM ${spec.table} WHERE id=?`).bind(id(c)).first();
    if (!row) throw new HttpError(404, 'Introuvable');
    return json(row);
  });
  r.post(`/api/${name}`, async (c) => {
    const u = requirePerm(c, 'write');
    const { value, errors } = validate(spec.schema, await readJson(c.req));
    assertValid(errors);
    await crossChecks(c, name, value);
    const keys = Object.keys(value).filter((k) => value[k] !== null);
    const extra: Record<string, unknown> = { created_by: u.id, source: 'manual' };
    if (name === 'fx_rates' || name === 'market_prices') extra.source_type = 'manual';
    if (name === 'fx_rates' || name === 'savings') delete extra.source;
    if (name === 'market_prices') delete extra.source; // `source` is a business field here
    if (name === 'offers') { extra.validated_by = u.id; extra.validated_at = new Date().toISOString(); }
    const allKeys = [...keys, ...Object.keys(extra)];
    const res = await c.env.DB.prepare(`INSERT INTO ${spec.table} (${allKeys.join(',')}) VALUES (${allKeys.map(() => '?').join(',')})`)
      .bind(...keys.map((k) => value[k]), ...Object.values(extra)).run();
    const newId = Number(res.meta.last_row_id);
    await auditCtx(c, `${name}.create`, name, newId, value);
    if (AUTO_ENTITIES.has(name)) autoAnalyze(c);
    return json({ id: newId }, 201);
  });
  r.put(`/api/${name}/:id`, async (c) => {
    requirePerm(c, 'write');
    const rid = id(c);
    const before = await c.env.DB.prepare(`SELECT * FROM ${spec.table} WHERE id=?`).bind(rid).first();
    if (!before) throw new HttpError(404, 'Introuvable');
    const { value, errors } = validate(spec.schema, await readJson(c.req), { partial: true });
    assertValid(errors);
    await crossChecks(c, name, { ...(before as any), ...value });
    const keys = Object.keys(value);
    if (!keys.length) throw new HttpError(422, 'Aucun champ à mettre à jour');
    const hasUpdated = ['suppliers', 'offers', 'production', 'savings'].includes(name);
    await c.env.DB.prepare(`UPDATE ${spec.table} SET ${keys.map((k) => `${k}=?`).join(', ')}${hasUpdated ? ", updated_at=datetime('now')" : ''} WHERE id=?`)
      .bind(...keys.map((k) => value[k]), rid).run();
    const changed = Object.fromEntries(keys.filter((k) => (before as any)[k] !== value[k]).map((k) => [k, [(before as any)[k], value[k]]]));
    await auditCtx(c, `${name}.update`, name, rid, changed);
    if (AUTO_ENTITIES.has(name)) autoAnalyze(c);
    return json({ ok: true });
  });
  r.del(`/api/${name}/:id`, async (c) => {
    requirePerm(c, 'approve');
    const rid = id(c);
    const row = await c.env.DB.prepare(`SELECT * FROM ${spec.table} WHERE id=?`).bind(rid).first();
    if (!row) throw new HttpError(404, 'Introuvable');
    if (name === 'suppliers') {
      const n = await c.env.DB.prepare('SELECT COUNT(*) n FROM h360_offers WHERE supplier_id=?').bind(rid).first<{ n: number }>();
      if (n && n.n > 0) throw new HttpError(409, 'Fournisseur lié à des offres : désactivez-le plutôt que de le supprimer');
    }
    if (name === 'offers') await c.env.DB.prepare('DELETE FROM h360_negotiations WHERE offer_id=?').bind(rid).run();
    await c.env.DB.prepare(`DELETE FROM ${spec.table} WHERE id=?`).bind(rid).run();
    await auditCtx(c, `${name}.delete`, name, rid, row);
    if (AUTO_ENTITIES.has(name)) autoAnalyze(c);
    return json({ ok: true });
  });
}

async function crossChecks(c: Ctx, name: string, v: Record<string, any>) {
  if (name === 'offers') {
    if (v.supplier_id) {
      const s = await c.env.DB.prepare('SELECT id FROM h360_suppliers WHERE id=?').bind(v.supplier_id).first();
      if (!s) throw new HttpError(422, 'Données invalides', { supplier_id: 'fournisseur inexistant' });
    }
    if (v.valid_until && v.offer_date && v.valid_until < v.offer_date) throw new HttpError(422, 'Données invalides', { valid_until: 'antérieure à la date de l’offre' });
    const rec = ['SWL', 'HWS', 'SOP'].includes(v.grade);
    if (v.category === 'virgin_pulp' && rec) throw new HttpError(422, 'Données invalides', { grade: 'SWL/HWS/SOP sont des papiers recyclés' });
  }
  if (name === 'production') {
    if (v.period_end < v.period_start) throw new HttpError(422, 'Données invalides', { period_end: 'avant la date de début' });
    if (v.gross_t && v.saleable_t > v.gross_t * 1.001) throw new HttpError(422, 'Données invalides', { saleable_t: 'supérieur à la production brute' });
  }
}

export function dataRoutes(r: Router) {
  // ── Smart defaults & calculation context for live previews (registered before /:id routes)
  r.get('/api/defaults/context', async (c) => {
    requirePerm(c, 'read');
    const [f, s] = await Promise.all([fibreAnalysis(c.env), getSettings(c.env)]);
    return json({
      fx: Object.fromEntries(Object.entries(f.fx).map(([k, v]) => [k, v.rate])), fx_dates: Object.fromEntries(Object.entries(f.fx).map(([k, v]) => [k, v.date])),
      references: f.references, fin: f.settings.fin, negotiation_margin_pct: f.settings.negotiation_margin_pct, target_margin_pct: num(s, 'target_margin_pct', 12),
      vp_reference: { SWL: s.vp_reference_SWL, HWS: s.vp_reference_HWS, SOP: s.vp_reference_SOP },
      quality_equivalence: { SWL: num(s, 'quality_equivalence_SWL', 95), HWS: num(s, 'quality_equivalence_HWS', 90), SOP: num(s, 'quality_equivalence_SOP', 92) },
      best_by_grade: Object.fromEntries(Object.entries(f.ranking).map(([g, list]) => [g, list[0] ?? null])),
    });
  });
  r.get('/api/defaults/offer', async (c) => {
    requirePerm(c, 'read');
    const sid = Number(c.url.searchParams.get('supplier_id')) || null;
    const grade = c.url.searchParams.get('grade') || null;
    const cols = 'id, supplier_id, grade, category, currency, incoterm, quantity_t, freight_tnd_t, customs_pct, handling_tnd_t, processing_tnd_t, energy_extra_tnd_t, chemicals_extra_tnd_t, other_tnd_t, moisture_pct, contamination_pct, process_loss_pct, payment_terms_days, price, offer_date';
    const tries: [string, unknown[], string][] = [];
    if (sid && grade) tries.push(['supplier_id = ? AND grade = ?', [sid, grade], 'dernière offre de ce fournisseur pour ce grade']);
    if (grade) tries.push(['grade = ?', [grade], 'dernière offre de ce grade (autre fournisseur)']);
    if (sid) tries.push(['supplier_id = ?', [sid], 'dernière offre de ce fournisseur']);
    let last: any = null, basis = '';
    for (const [w, b, label] of tries) { last = await c.env.DB.prepare(`SELECT ${cols} FROM h360_offers WHERE ${w} ORDER BY offer_date DESC, id DESC LIMIT 1`).bind(...b).first(); if (last) { basis = label; break; } }
    const sup: any = sid ? await c.env.DB.prepare('SELECT payment_terms_days, incoterm, categories FROM h360_suppliers WHERE id=?').bind(sid).first() : null;
    const values: Record<string, unknown> = {};
    if (last) for (const k of ['currency', 'incoterm', 'freight_tnd_t', 'customs_pct', 'handling_tnd_t', 'processing_tnd_t', 'energy_extra_tnd_t', 'chemicals_extra_tnd_t', 'other_tnd_t', 'moisture_pct', 'contamination_pct', 'process_loss_pct', 'payment_terms_days', 'quantity_t']) if (last[k] !== null && last[k] !== undefined) values[k] = last[k];
    if (sup?.payment_terms_days && values.payment_terms_days === undefined) values.payment_terms_days = sup.payment_terms_days;
    if (sup?.incoterm && !values.incoterm) values.incoterm = sup.incoterm;
    return json({ values, basis, previous_price: last && last.supplier_id === sid && last.grade === grade ? { price: last.price, currency: last.currency, date: last.offer_date, id: last.id } : null, supplier_categories: sup?.categories ?? null });
  });
  r.get('/api/defaults/production', async (c) => {
    requirePerm(c, 'read');
    const m = c.url.searchParams.get('machine');
    if (!['PM1', 'PM2'].includes(m || '')) throw new HttpError(422, 'machine requise');
    const p: any = await c.env.DB.prepare("SELECT * FROM h360_production_periods WHERE machine=? AND validation_status='validated' ORDER BY period_end DESC LIMIT 1").bind(m).first();
    if (!p) return json({ values: {}, basis: null, unit: {} });
    const next = new Date(new Date(p.period_end + 'T00:00:00Z').getTime() + 86400000);
    const end = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0));
    const values: Record<string, unknown> = { period_start: next.toISOString().slice(0, 10), period_end: end.toISOString().slice(0, 10), product_grade: p.product_grade };
    for (const k of ['electricity_tariff', 'gas_tariff', 'steam_cost_tnd_t', 'water_tariff', 'available_h']) if (p[k]) values[k] = p[k];
    const per = (a: number, b: number) => (b > 0 && a > 0 ? Math.round((a / b) * 100) / 100 : null);
    return json({
      values, basis: `période ${p.period_start} → ${p.period_end}`,
      unit: { vp_price_tnd_t: per(p.vp_cost_tnd, p.vp_t), recovered_price_tnd_t: per(p.recovered_cost_tnd, p.recovered_t) },
      fixed: { labour_tnd: p.labour_tnd, maintenance_tnd: p.maintenance_tnd, fixed_overhead_tnd: p.fixed_overhead_tnd },
      last: { saleable_t: p.saleable_t, avg_selling_price_tnd_t: p.avg_selling_price_tnd_t },
    });
  });

  for (const n of Object.keys(ENTITIES)) entityRoutes(r, n);

  // ── Offer workflow actions
  r.post('/api/offers/:id/validate', async (c) => {
    const u = requirePerm(c, 'write');
    const b = await readJson<any>(c.req);
    const decision = b.decision === 'reject' ? 'rejected' : 'validated';
    await c.env.DB.prepare("UPDATE h360_offers SET validation_status=?, status=CASE WHEN ?='validated' AND status='pending_validation' THEN 'active' WHEN ?='rejected' THEN 'rejected' ELSE status END, validated_by=?, validated_at=datetime('now'), updated_at=datetime('now') WHERE id=?")
      .bind(decision, decision, decision, u.id, id(c)).run();
    await auditCtx(c, `offers.${decision}`, 'offers', id(c));
    autoAnalyze(c);
    return json({ ok: true });
  });
  r.post('/api/offers/:id/quality', async (c) => {
    requirePerm(c, 'write');
    const b = await readJson<any>(c.req);
    if (!['pending', 'approved', 'rejected', 'not_tested'].includes(b.quality_status)) throw new HttpError(422, 'Statut qualité invalide');
    await c.env.DB.prepare("UPDATE h360_offers SET quality_status=?, quality_notes=?, updated_at=datetime('now') WHERE id=?").bind(b.quality_status, String(b.quality_notes || '').slice(0, 2000), id(c)).run();
    await auditCtx(c, 'offers.quality', 'offers', id(c), { quality_status: b.quality_status });
    autoAnalyze(c);
    return json({ ok: true });
  });
  r.post('/api/offers/:id/ceiling-exception', async (c) => {
    const u = requirePerm(c, 'approve'); // director-only business rule override
    const b = await readJson<any>(c.req);
    const on = b.authorize ? 1 : 0;
    if (on && String(b.note || '').trim().length < 10) throw new HttpError(422, 'Justification obligatoire (10 caractères min.)');
    await c.env.DB.prepare("UPDATE h360_offers SET ceiling_exception=?, ceiling_exception_by=?, ceiling_exception_note=?, updated_at=datetime('now') WHERE id=?").bind(on, on ? u.id : null, on ? String(b.note).slice(0, 1000) : null, id(c)).run();
    await auditCtx(c, on ? 'offers.ceiling_exception_authorized' : 'offers.ceiling_exception_revoked', 'offers', id(c), { note: b.note });
    return json({ ok: true });
  });
  r.get('/api/offers/:id/negotiations', async (c) => {
    requirePerm(c, 'read');
    return json((await c.env.DB.prepare('SELECT n.*, u.name AS user_name FROM h360_negotiations n LEFT JOIN h360_users u ON u.id=n.created_by WHERE offer_id=? ORDER BY event_date DESC, id DESC').bind(id(c)).all()).results);
  });
  r.post('/api/offers/:id/negotiations', async (c) => {
    const u = requirePerm(c, 'write');
    const { value, errors } = validate({ event_date: { type: 'date', required: true }, kind: { type: 'string', required: true, enum: ['note', 'counter_offer', 'supplier_reply', 'decision'] }, price: { type: 'number', min: 0 }, note: { type: 'string', max: 2000 } }, await readJson(c.req));
    assertValid(errors);
    const oid = id(c);
    await c.env.DB.prepare('INSERT INTO h360_negotiations (offer_id, event_date, kind, price, note, created_by) VALUES (?,?,?,?,?,?)').bind(oid, value.event_date, value.kind, value.price, value.note, u.id).run();
    if (value.kind === 'supplier_reply' && value.price) await c.env.DB.prepare("UPDATE h360_offers SET negotiated_price=?, status='negotiating', updated_at=datetime('now') WHERE id=?").bind(value.price, oid).run();
    else await c.env.DB.prepare("UPDATE h360_offers SET status=CASE WHEN status='active' THEN 'negotiating' ELSE status END WHERE id=?").bind(oid).run();
    await auditCtx(c, 'offers.negotiation_event', 'offers', oid, value);
    return json({ ok: true }, 201);
  });

  r.post('/api/market_prices/:id/validate', async (c) => {
    requirePerm(c, 'write');
    const b = await readJson<any>(c.req);
    const st = b.decision === 'reject' ? 'rejected' : 'validated';
    await c.env.DB.prepare('UPDATE h360_market_prices SET validation_status=? WHERE id=?').bind(st, id(c)).run();
    await auditCtx(c, `market_prices.${st}`, 'market_prices', id(c));
    autoAnalyze(c);
    return json({ ok: true });
  });
  r.post('/api/production/:id/validate', async (c) => {
    requirePerm(c, 'write');
    const b = await readJson<any>(c.req);
    const st = b.decision === 'reject' ? 'rejected' : 'validated';
    await c.env.DB.prepare("UPDATE h360_production_periods SET validation_status=?, updated_at=datetime('now') WHERE id=?").bind(st, id(c)).run();
    await auditCtx(c, `production.${st}`, 'production', id(c));
    autoAnalyze(c);
    return json({ ok: true });
  });

  // ── Recommendations & approvals (internal workflow only — never triggers external actions)
  r.get('/api/recommendations', async (c) => {
    requirePerm(c, 'read');
    const st = c.url.searchParams.get('status');
    const mod = c.url.searchParams.get('module');
    const where = [st ? 'r.status = ?' : "r.status != 'superseded'", ...(mod ? ['r.module = ?'] : [])];
    const rows = (await c.env.DB.prepare(`SELECT r.*, u.name AS decided_by_name FROM h360_recommendations r LEFT JOIN h360_users u ON u.id = r.decided_by WHERE ${where.join(' AND ')} ORDER BY CASE r.status WHEN 'proposed' THEN 0 WHEN 'more_analysis' THEN 1 ELSE 2 END, r.id DESC LIMIT 200`)
      .bind(...[st, mod].filter(Boolean)).all<any>()).results;
    return json(rows.map((x: any) => ({ ...x, inputs: x.inputs_json ? JSON.parse(x.inputs_json) : null, calc: x.calc_json ? JSON.parse(x.calc_json) : null, inputs_json: undefined, calc_json: undefined })));
  });
  r.post('/api/recommendations/:id/decision', async (c) => {
    const u = requirePerm(c, 'approve');
    const b = await readJson<any>(c.req);
    const map: Record<string, string> = { approve: 'approved', reject: 'rejected', more_analysis: 'more_analysis' };
    const st = map[b.decision];
    if (!st) throw new HttpError(422, 'Décision invalide');
    if (st !== 'approved' && String(b.note || '').trim().length < 3) throw new HttpError(422, 'Un commentaire est requis pour rejeter ou demander une analyse');
    const rec = await c.env.DB.prepare('SELECT * FROM h360_recommendations WHERE id=?').bind(id(c)).first<any>();
    if (!rec) throw new HttpError(404, 'Introuvable');
    if (['approved', 'rejected', 'superseded'].includes(rec.status)) throw new HttpError(409, 'Décision déjà prise');
    await c.env.DB.prepare("UPDATE h360_recommendations SET status=?, decided_by=?, decided_at=datetime('now'), decision_note=?, updated_at=datetime('now') WHERE id=?").bind(st, u.id, String(b.note || '').slice(0, 2000) || null, rec.id).run();
    let savingsId: number | null = null;
    if (st === 'approved' && rec.savings_tnd && rec.savings_tnd > 0) {
      const cat = ({ recovered: 'fibre', virgin_pulp: 'fibre', purchasing: 'fibre', energy: 'energy', pricing: 'pricing', production: 'yield' } as Record<string, string>)[rec.module] || 'other';
      const s = await c.env.DB.prepare("INSERT INTO h360_savings (title, category, description, projected_tnd, status, recommendation_id, created_by) VALUES (?,?,?,?, 'validated', ?, ?)").bind(rec.title, cat, rec.summary, rec.savings_tnd, rec.id, u.id).run();
      savingsId = Number(s.meta.last_row_id);
    }
    await auditCtx(c, `recommendations.${st}`, 'recommendations', rec.id, { note: b.note, savings_id: savingsId });
    return json({ ok: true, status: st, savings_id: savingsId, external_actions: 'aucune — statut interne uniquement' });
  });

  r.get('/api/alerts', async (c) => {
    requirePerm(c, 'read');
    const all = c.url.searchParams.get('all') === '1';
    return json((await c.env.DB.prepare(`SELECT * FROM h360_alerts ${all ? '' : 'WHERE acknowledged_at IS NULL'} ORDER BY id DESC LIMIT 200`).all()).results);
  });
  r.post('/api/alerts/:id/ack', async (c) => {
    const u = requirePerm(c, 'write');
    await c.env.DB.prepare("UPDATE h360_alerts SET acknowledged_by=?, acknowledged_at=datetime('now') WHERE id=?").bind(u.id, id(c)).run();
    await auditCtx(c, 'alerts.ack', 'alerts', id(c));
    return json({ ok: true });
  });
}
