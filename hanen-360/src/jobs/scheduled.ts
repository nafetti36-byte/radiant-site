import type { Env } from '../env';
import { runJob, reapStaleJobs } from './runner';
import { connectorEnabled, notify, syncPulpFeed, updateFx } from './connectors';
import { runEngineScan, supplierRanking } from '../engine/recommend';
import { storeReport } from './reports';
import { getSettings, num } from '../lib/settings';
import { computePeriod } from '../engine/costing';

export async function recalcCosting(env: Env) {
  const s = await getSettings(env);
  const tm = num(s, 'target_margin_pct', 12);
  const rows = (await env.DB.prepare("SELECT * FROM h360_production_periods WHERE validation_status='validated'").all<any>()).results;
  let ok = 0, failed = 0;
  for (const r of rows) {
    try {
      const res = computePeriod(r, tm);
      await env.DB.prepare("UPDATE h360_production_periods SET computed_json=?, computed_at=datetime('now') WHERE id=?").bind(JSON.stringify({ cost_t: res.cost_per_saleable_t, full_t: res.full_cost_per_t, fibre_pct: res.fibre_pct, energy_pct: res.energy_pct }), r.id).run();
      ok++;
    } catch { failed++; }
  }
  return { recalculated: ok, failed };
}

export async function dailyPipeline(env: Env, triggeredBy: string) {
  await reapStaleJobs(env);
  const results: Record<string, unknown> = {};
  if (await connectorEnabled(env, 'fx')) results.fx = await runJob(env, 'fx_update', 'currency_risk', triggeredBy, null, () => updateFx(env, triggeredBy));
  if (await connectorEnabled(env, 'pulp_feed')) results.pulp = await runJob(env, 'pulp_feed_sync', 'data_integration', triggeredBy, null, () => syncPulpFeed(env));
  results.recalc = await runJob(env, 'cost_recalculation', 'manufacturing_cost_engineer', triggeredBy, null, () => recalcCosting(env));
  results.scan = await runJob(env, 'engine_scan', 'procurement_analyst', triggeredBy, null, () => runEngineScan(env));
  results.ranking = await runJob(env, 'supplier_ranking', 'procurement_analyst', triggeredBy, null, () => supplierRanking(env));
  results.report = await runJob(env, 'daily_report', 'reporting_forecasting', triggeredBy, null, async () => {
    const r = await storeReport(env, 'daily', triggeredBy);
    const crit = (await env.DB.prepare("SELECT COUNT(*) n FROM h360_alerts WHERE severity='critical' AND acknowledged_at IS NULL").first<{ n: number }>())?.n ?? 0;
    const sent = crit ? await notify(env, `Hanen 360 — ${crit} alerte(s) critique(s) non traitée(s). Rapport: ${r.label}`) : { sent: false, reason: 'aucune alerte critique' };
    return { report_id: r.id, notification: sent };
  });
  return results;
}

export async function weeklyPipeline(env: Env, triggeredBy: string) {
  return runJob(env, 'weekly_report', 'reporting_forecasting', triggeredBy, null, async () => {
    const r = await storeReport(env, 'weekly', triggeredBy);
    const d = r.data;
    const msg = `Hanen 360 — rapport hebdomadaire (${r.label}). Économies réalisées: ${Math.round(d.savings.realized)} TND / prévues: ${Math.round(d.savings.validated_projected)} TND. Décisions en attente: ${d.pending_decisions.length}.`;
    return { report_id: r.id, notification: await notify(env, msg) };
  });
}

export async function handleScheduled(event: ScheduledController, env: Env) {
  if (event.cron === '0 6 * * 1') await weeklyPipeline(env, 'cron:weekly');
  else await dailyPipeline(env, 'cron:daily');
}
