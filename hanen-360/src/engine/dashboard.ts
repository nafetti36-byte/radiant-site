import type { Env } from '../env';
import { costingPeriods, energyKpis, fibreAnalysis, latestByMachine, marketSeries, savingsSummary, variance } from './data';
import { round } from '../lib/http';

export async function dashboardData(env: Env) {
  const [counts, fibre, periods, market, savings] = await Promise.all([
    env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM h360_suppliers WHERE active=1) suppliers,
        (SELECT COUNT(*) FROM h360_offers) offers,
        (SELECT COUNT(*) FROM h360_market_prices) market_prices,
        (SELECT COUNT(*) FROM h360_fx_rates) fx_rates,
        (SELECT COUNT(*) FROM h360_production_periods) periods,
        (SELECT COUNT(*) FROM h360_recommendations WHERE status IN ('proposed','more_analysis')) pending_decisions,
        (SELECT COUNT(*) FROM h360_alerts WHERE acknowledged_at IS NULL) open_alerts,
        (SELECT COUNT(*) FROM h360_offers WHERE validation_status='pending' OR status='pending_validation') pending_validation,
        (SELECT COUNT(*) FROM h360_inbound_docs WHERE status IN ('pending','extracted')) inbound_pending`).first<any>(),
    fibreAnalysis(env), costingPeriods(env, { limit: 24 }), marketSeries(env, undefined, 365), savingsSummary(env),
  ]);
  const latest = latestByMachine(periods);
  const setup = [
    { key: 'fx', done: counts.fx_rates > 0, route: '#/admin?tab=fx' },
    { key: 'suppliers', done: counts.suppliers > 0, route: '#/purchasing' },
    { key: 'market', done: counts.market_prices > 0, route: '#/pulp' },
    { key: 'offers', done: counts.offers > 0, route: '#/purchasing?tab=offers' },
    { key: 'production', done: counts.periods > 0, route: '#/production' },
  ];
  const alerts = (await env.DB.prepare("SELECT * FROM h360_alerts WHERE acknowledged_at IS NULL ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, id DESC LIMIT 8").all<any>()).results;
  const decisions = (await env.DB.prepare("SELECT id, module, title, savings_tnd, confidence, created_at FROM h360_recommendations WHERE status IN ('proposed','more_analysis') ORDER BY COALESCE(savings_tnd,0) DESC LIMIT 6").all<any>()).results;
  const costTrend = periods.filter((p) => p.result).slice().reverse().map((p) => ({ machine: p.machine, period_end: p.period_end, cost_t: round(p.result.cost_per_saleable_t, 1), price_t: p.avg_selling_price_tnd_t }));
  return {
    counts, setup, setup_complete: setup.every((s) => s.done),
    machines: Object.fromEntries(Object.entries(latest).map(([m, p]: [string, any]) => [m, {
      period_id: p.id, period: `${p.period_start} → ${p.period_end}`, grade: p.product_grade, saleable_t: p.saleable_t,
      cost_t: round(p.result.cost_per_saleable_t, 1), full_cost_t: round(p.result.full_cost_per_t, 1), fibre_pct: round(p.result.fibre_pct, 1), energy_pct: round(p.result.energy_pct, 1),
      margin_pct: round(p.result.gross_margin_pct, 1), price_t: p.avg_selling_price_tnd_t, break_even_t: round(p.result.break_even_price_tnd_t, 1), target_t: round(p.result.target_price_tnd_t, 1),
      lines: p.result.lines.map((l: any) => ({ key: l.key, label: l.label, tnd_t: round(l.tnd_t, 1), pct: round(l.pct, 1) })),
    }])),
    cost_trend: costTrend,
    fibre: {
      references: fibre.references,
      best: Object.fromEntries(Object.entries(fibre.ranking).map(([g, r]) => [g, r[0]])),
      negotiation_potential_tnd: round((fibre.offers as any[]).filter((o) => o.validation_status === 'validated').reduce((a, o) => a + (o.negotiation?.expected_savings_tnd ?? 0), 0), 0),
      above_ceiling: (fibre.offers as any[]).filter((o) => o.negotiation?.above_ceiling && o.category === 'recovered').length,
      warnings: fibre.warnings,
    },
    market: Object.fromEntries(Object.entries(market.trends).map(([g, t]: [string, any]) => [g, { price: t.latest.price, currency: t.latest.currency, date: t.latest.price_date, change_pct: round(t.change_pct, 1), source: t.latest.source }])),
    energy: Object.fromEntries(Object.entries(energyKpis(periods)).map(([m, k]: [string, any]) => [m, { latest: k.latest, gap_to_best_tnd: round(k.gap_to_best_tnd, 0) }])),
    variances: variance(periods).map((v) => ({ machine: v.machine, delta_pct: round(v.delta_pct, 1), delta_t: round(v.delta_t, 1), main_driver: v.drivers[0]?.label })),
    savings, alerts, decisions, fx: fibre.fx,
  };
}
