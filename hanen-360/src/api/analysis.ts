import type { Router } from '../router';
import { HttpError, json, readJson, round } from '../lib/http';
import { require as requirePerm } from '../lib/auth';
import { auditCtx } from '../lib/audit';
import { costingPeriods, energyKpis, fibreAnalysis, marketSeries, savingsSummary, variance } from '../engine/data';
import { dashboardData } from '../engine/dashboard';
import { simulatePrice } from '../engine/costing';
import { getSettings, num } from '../lib/settings';
import { runJob } from '../jobs/runner';
import { runEngineScan } from '../engine/recommend';
import { dailyPipeline } from '../jobs/scheduled';
import { TOOLS } from '../ai/tools';

export function analysisRoutes(r: Router) {
  r.get('/api/dashboard', async (c) => { requirePerm(c, 'read'); return json(await dashboardData(c.env)); });

  r.get('/api/analysis/fibre', async (c) => {
    requirePerm(c, 'read');
    return json(await fibreAnalysis(c.env, { grade: c.url.searchParams.get('grade') || undefined, include_inactive: c.url.searchParams.get('all') === '1' }));
  });

  r.get('/api/analysis/market', async (c) => {
    requirePerm(c, 'read');
    return json(await marketSeries(c.env, c.url.searchParams.get('grade') || undefined, Number(c.url.searchParams.get('days')) || 365));
  });

  r.get('/api/analysis/costing', async (c) => {
    requirePerm(c, 'read');
    const p = c.url.searchParams;
    const periods = await costingPeriods(c.env, { machine: p.get('machine') || undefined, grade: p.get('grade') || undefined, from: p.get('from') || undefined, to: p.get('to') || undefined, limit: Number(p.get('limit')) || 60 });
    return json({ periods, variance: variance(periods) });
  });

  r.get('/api/analysis/energy', async (c) => {
    requirePerm(c, 'read');
    return json(energyKpis(await costingPeriods(c.env, { machine: c.url.searchParams.get('machine') || undefined, limit: 36 })));
  });

  r.get('/api/analysis/savings', async (c) => { requirePerm(c, 'read'); return json(await savingsSummary(c.env)); });

  r.post('/api/analysis/price-simulation', async (c) => {
    const u = requirePerm(c, 'read');
    const b = await readJson<any>(c.req);
    const [p] = (await costingPeriods(c.env, { limit: 500 })).filter((x) => x.id === Number(b.period_id));
    if (!p?.result) throw new HttpError(422, 'Choisir une période de production validée comme base');
    const s = await getSettings(c.env);
    const n = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));
    const res = simulatePrice({
      base: p.result, saleable_t: p.saleable_t,
      fibre_price_change_pct: n(b.fibre_price_change_pct) ?? 0, energy_price_change_pct: n(b.energy_price_change_pct) ?? 0,
      chemicals_change_pct: n(b.chemicals_change_pct) ?? 0, volume_change_pct: n(b.volume_change_pct) ?? 0,
      proposed_price_tnd_t: n(b.proposed_price_tnd_t), current_price_tnd_t: n(b.current_price_tnd_t) ?? p.avg_selling_price_tnd_t,
      competitor_price_tnd_t: n(b.competitor_price_tnd_t), target_margin_pct: n(b.target_margin_pct) ?? num(s, 'target_margin_pct', 12),
    });
    if (b.save && String(b.name || '').trim()) {
      if (!['analyst', 'director', 'admin'].includes(u.role)) throw new HttpError(403, 'Permission insuffisante');
      const ins = await c.env.DB.prepare('INSERT INTO h360_price_simulations (name, machine, product_grade, base_period_id, inputs_json, result_json, created_by) VALUES (?,?,?,?,?,?,?)')
        .bind(String(b.name).slice(0, 120), p.machine, p.product_grade, p.id, JSON.stringify(b), JSON.stringify(res), u.id).run();
      await auditCtx(c, 'pricing.simulation_saved', 'price_simulations', Number(ins.meta.last_row_id));
      return json({ ...res, saved_id: Number(ins.meta.last_row_id), base: { period_id: p.id, machine: p.machine, grade: p.product_grade } });
    }
    return json({ ...res, base: { period_id: p.id, machine: p.machine, grade: p.product_grade, cost_t: round(p.result.cost_per_saleable_t, 1) } });
  });

  r.get('/api/price-simulations', async (c) => {
    requirePerm(c, 'read');
    const rows = (await c.env.DB.prepare('SELECT s.*, u.name AS user_name FROM h360_price_simulations s LEFT JOIN h360_users u ON u.id=s.created_by ORDER BY s.id DESC LIMIT 100').all<any>()).results;
    return json(rows.map((x: any) => ({ ...x, inputs: JSON.parse(x.inputs_json), result: JSON.parse(x.result_json), inputs_json: undefined, result_json: undefined })));
  });

  r.post('/api/analysis/ceiling', async (c) => {
    const u = requirePerm(c, 'read');
    const b = await readJson<any>(c.req);
    if (!['SWL', 'HWS', 'SOP'].includes(b.grade) || !(Number(b.price) > 0) || !/^[A-Z]{3}$/.test(b.currency || '')) throw new HttpError(422, 'Grade, prix et devise requis');
    try { return json(await TOOLS.compute_ceiling.run(c.env, b, { user: u, agent: 'recovered_paper_analyst' })); }
    catch (e: any) { throw new HttpError(422, e.message); }
  });

  // On-demand "Analyser" buttons
  r.post('/api/analysis/run', async (c) => {
    const u = requirePerm(c, 'write');
    const res = await runJob(c.env, 'engine_scan', 'procurement_analyst', `user:${u.email}`, null, () => runEngineScan(c.env));
    await auditCtx(c, 'analysis.run', 'jobs', res.job_id);
    return json(res);
  });
  r.post('/api/analysis/pipeline', async (c) => {
    const u = requirePerm(c, 'approve');
    const res = await dailyPipeline(c.env, `user:${u.email}`);
    await auditCtx(c, 'automation.pipeline_manual');
    return json(res);
  });
}
