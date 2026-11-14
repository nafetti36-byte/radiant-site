import type { Env } from '../env';
import { costingPeriods, energyKpis, fibreAnalysis, latestByMachine, marketSeries, savingsSummary, variance } from '../engine/data';
import { round, today } from '../lib/http';
import { buildPdf, type Block } from '../lib/pdf';
import { writeXlsx, type Sheet } from '../lib/xlsx';

/** Report built exclusively from validated records. Empty sections say so explicitly. */
export async function buildReportData(env: Env, kind: 'daily' | 'weekly' | 'adhoc') {
  const [fibre, periods, market, savings] = await Promise.all([fibreAnalysis(env), costingPeriods(env, { limit: 24 }), marketSeries(env, undefined, kind === 'weekly' ? 120 : 60), savingsSummary(env)]);
  const latest = latestByMachine(periods);
  const pending = (await env.DB.prepare("SELECT id, module, title, savings_tnd, confidence, created_at FROM h360_recommendations WHERE status IN ('proposed','more_analysis') ORDER BY savings_tnd DESC NULLS LAST LIMIT 30").all<any>()).results;
  const alerts = (await env.DB.prepare("SELECT severity, type, message, created_at FROM h360_alerts WHERE acknowledged_at IS NULL ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, id DESC LIMIT 30").all<any>()).results;
  const energy = energyKpis(periods);
  const offers = (fibre.offers as any[]).filter((o) => o.cost && o.validation_status === 'validated');
  return {
    kind, generated_at: new Date().toISOString(), date: today(),
    cost_per_tonne: Object.values(latest).map((p: any) => ({ machine: p.machine, grade: p.product_grade, period: `${p.period_start} → ${p.period_end}`, saleable_t: p.saleable_t, cost_t: round(p.result.cost_per_saleable_t, 1), full_cost_t: round(p.result.full_cost_per_t, 1), fibre_pct: round(p.result.fibre_pct, 1), energy_pct: round(p.result.energy_pct, 1), price_t: p.avg_selling_price_tnd_t, margin_pct: round(p.result.gross_margin_pct, 1), break_even_t: round(p.result.break_even_price_tnd_t, 1), target_t: round(p.result.target_price_tnd_t, 1) })),
    fibre_comparison: offers.map((o) => ({ offer_id: o.id, supplier: o.supplier_name, grade: o.grade, price: o.price, currency: o.currency, effective_tnd: round(o.cost.effective_tnd_per_usable_t, 1), yield_pct: round(o.cost.usable_yield * 100, 1), max_price: round(o.negotiation?.max_price, 2), target_price: round(o.negotiation?.target_price, 2), savings_tnd: round(o.negotiation?.expected_savings_tnd, 0), quality: o.quality_status })),
    vp_references: Object.values(fibre.references).map((r) => ({ grade: r.grade, effective_tnd: round(r.effective_tnd, 1), source: r.source, date: r.date })),
    market_trends: Object.entries(market.trends).map(([g, t]: [string, any]) => ({ grade: g, latest: t.latest.price, currency: t.latest.currency, date: t.latest.price_date, change_pct: round(t.change_pct, 1), source: t.latest.source })),
    energy: Object.entries(energy).map(([m, k]: [string, any]) => ({ machine: m, kwh_t: round(k.latest?.kwh_t, 0), steam_t: round(k.latest?.steam_t, 3), energy_cost_t: round(k.latest?.energy_cost_t, 1), best_energy_cost_t: round(k.best?.energy_cost_t, 1), gap_tnd: round(k.gap_to_best_tnd, 0), reject_pct: round(k.latest?.reject_pct, 2) })),
    variances: variance(periods).map((v) => ({ machine: v.machine, previous_t: round(v.previous_cost_t, 1), current_t: round(v.current_cost_t, 1), delta_pct: round(v.delta_pct, 1), main_driver: v.drivers[0]?.label, main_driver_delta_t: round(v.drivers[0]?.delta_t, 1) })),
    purchasing_risk: [
      ...offers.filter((o) => o.valid_until && o.valid_until <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)).map((o) => `Offre #${o.id} ${o.supplier_name} ${o.grade} expire le ${o.valid_until}`),
      ...offers.filter((o) => o.category === 'recovered' && o.quality_status !== 'approved').map((o) => `Offre #${o.id} ${o.supplier_name} ${o.grade}: qualité non validée`),
      ...offers.filter((o) => o.negotiation?.above_ceiling).map((o) => `Offre #${o.id} ${o.supplier_name} ${o.grade} au-dessus du plafond`),
      ...fibre.warnings,
    ],
    savings: savings.totals, savings_target: savings.annual_target_tnd,
    pending_decisions: pending, alerts,
  };
}

export async function storeReport(env: Env, kind: 'daily' | 'weekly' | 'adhoc', createdBy: string) {
  const data = await buildReportData(env, kind);
  const label = kind === 'weekly' ? `Semaine du ${data.date}` : `${kind === 'daily' ? 'Jour' : 'Rapport'} ${data.date}`;
  const r = await env.DB.prepare('INSERT INTO h360_reports (kind, period_label, data_json, created_by) VALUES (?,?,?,?)').bind(kind, label, JSON.stringify(data), createdBy).run();
  return { id: Number(r.meta.last_row_id), label, data };
}

const n = (v: any, d = 0) => (v === null || v === undefined || v === '' ? 'n.d.' : typeof v === 'number' ? v.toLocaleString('fr-FR', { maximumFractionDigits: d }).replace(/ | /g, ' ') : String(v));

export function reportPdf(label: string, d: any): Uint8Array {
  const b: Block[] = [
    { kind: 'h1', text: `Hanen 360 - ${label}` },
    { kind: 'small', text: `Azur Papier - généré le ${d.generated_at.replace('T', ' ').slice(0, 16)} UTC - données validées uniquement` },
    { kind: 'h2', text: '1. Coût par tonne vendable (PM1 / PM2)' },
    d.cost_per_tonne.length ? { kind: 'table', rows: [['Machine', 'Grade', 'Période', 'Coût/t', 'Coût complet/t', 'Fibre %', 'Énergie %', 'Prix/t', 'Marge %'], ...d.cost_per_tonne.map((r: any) => [r.machine, r.grade, r.period, n(r.cost_t, 1), n(r.full_cost_t, 1), n(r.fibre_pct, 1), n(r.energy_pct, 1), n(r.price_t), n(r.margin_pct, 1)])] } : { kind: 'p', text: 'Aucune période de production validée.' },
    { kind: 'h2', text: '2. Pâte vierge vs papiers recyclés (coût fibre effectif)' },
    d.fibre_comparison.length ? { kind: 'table', rows: [['#', 'Fournisseur', 'Grade', 'Prix', 'TND/t utile', 'Rdt %', 'Prix max', 'Cible', 'Économie TND'], ...d.fibre_comparison.map((r: any) => [r.offer_id, r.supplier, r.grade, `${n(r.price, 2)} ${r.currency}`, n(r.effective_tnd, 1), n(r.yield_pct, 1), n(r.max_price, 2), n(r.target_price, 2), n(r.savings_tnd)])] } : { kind: 'p', text: 'Aucune offre validée.' },
    { kind: 'h2', text: '3. Tendances marché' },
    d.market_trends.length ? { kind: 'table', rows: [['Grade', 'Dernier prix', 'Date', 'Variation %', 'Source'], ...d.market_trends.map((r: any) => [r.grade, `${n(r.latest)} ${r.currency}`, r.date, n(r.change_pct, 1), r.source])] } : { kind: 'p', text: 'Aucun prix marché validé sur la période.' },
    { kind: 'h2', text: '4. Énergie et pertes' },
    d.energy.length ? { kind: 'table', rows: [['Machine', 'kWh/t', 't vapeur/t', 'Énergie TND/t', 'Meilleur TND/t', 'Écart TND', 'Rebuts %'], ...d.energy.map((r: any) => [r.machine, n(r.kwh_t), n(r.steam_t, 3), n(r.energy_cost_t, 1), n(r.best_energy_cost_t, 1), n(r.gap_tnd), n(r.reject_pct, 2)])] } : { kind: 'p', text: 'Pas de données énergie.' },
    { kind: 'h2', text: '5. Écarts de coût' },
    d.variances.length ? { kind: 'table', rows: [['Machine', 'Préc. TND/t', 'Actuel TND/t', 'Écart %', 'Principal facteur', 'TND/t'], ...d.variances.map((r: any) => [r.machine, n(r.previous_t, 1), n(r.current_t, 1), n(r.delta_pct, 1), r.main_driver, n(r.main_driver_delta_t, 1)])] } : { kind: 'p', text: 'Moins de deux périodes par machine : pas d’écart calculable.' },
    { kind: 'h2', text: '6. Risques achats' },
    { kind: 'p', text: d.purchasing_risk.length ? d.purchasing_risk.map((x: string) => `- ${x}`).join('\n') : 'Aucun risque détecté.' },
    { kind: 'h2', text: '7. Économies réalisées vs prévues' },
    { kind: 'p', text: `Prévu (validé): ${n(d.savings.validated_projected)} TND - Réalisé: ${n(d.savings.realized)} TND - Objectif annuel: ${n(d.savings_target)} TND` },
    { kind: 'h2', text: '8. Décisions en attente de Hanen' },
    d.pending_decisions.length ? { kind: 'table', widths: [30, 70, 300, 70, 41], rows: [['#', 'Module', 'Recommandation', 'Économie', 'Conf.'], ...d.pending_decisions.map((r: any) => [r.id, r.module, r.title, n(r.savings_tnd), n((r.confidence ?? 0) * 100) + '%'])] } : { kind: 'p', text: 'Aucune décision en attente.' },
  ];
  return buildPdf(`Hanen 360 - ${label}`, b);
}

export function reportXlsx(d: any): Uint8Array {
  const sheet = (name: string, list: any[]): Sheet => ({ name, rows: list.length ? [Object.keys(list[0]), ...list.map((r) => Object.values(r).map((v) => (typeof v === 'object' && v !== null ? JSON.stringify(v) : (v as any))))] : [['Aucune donnée']] });
  return writeXlsx([
    sheet('Coût par tonne', d.cost_per_tonne), sheet('Fibres', d.fibre_comparison), sheet('Références VP', d.vp_references),
    sheet('Marché', d.market_trends), sheet('Énergie', d.energy), sheet('Écarts', d.variances),
    sheet('Risques', d.purchasing_risk.map((x: string) => ({ risque: x }))), sheet('Décisions', d.pending_decisions), sheet('Alertes', d.alerts),
    sheet('Économies', [d.savings]),
  ]);
}
