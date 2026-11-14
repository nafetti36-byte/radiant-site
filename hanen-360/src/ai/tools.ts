import type Anthropic from '@anthropic-ai/sdk';
import type { Env, User } from '../env';
import { costingPeriods, energyKpis, fibreAnalysis, marketSeries, savingsSummary, variance, fxMap } from '../engine/data';
import { dashboardData } from '../engine/dashboard';
import { effectiveCost, recoveredCeiling, negotiationTarget } from '../engine/fibre';
import { simulatePrice } from '../engine/costing';
import { upsertRecommendation } from '../engine/recommend';
import { getSettings, num } from '../lib/settings';
import { round } from '../lib/http';

type Json = Record<string, any>;
export interface ToolDef { owner: string; def: Anthropic.Tool; run: (env: Env, input: Json, ctx: { user: User; agent: string }) => Promise<unknown> }

const obj = (properties: Record<string, any>, required: string[] = []) => ({ type: 'object' as const, properties, required, additionalProperties: false });
const str = (description: string, e?: string[]) => ({ type: 'string', description, ...(e ? { enum: e } : {}) });
const numb = (description: string) => ({ type: 'number', description });

/** Shrinks engine output so tool results stay compact and cache-friendly. */
function compactOffer(o: any) {
  return {
    offer_id: o.id, supplier: o.supplier_name, supplier_id: o.supplier_id, category: o.category, grade: o.grade, offer_date: o.offer_date, valid_until: o.valid_until,
    status: o.status, validation_status: o.validation_status, quality_status: o.quality_status, price: o.price, currency: o.currency, quantity_t: o.quantity_t,
    fx_tnd: o.fx_tnd, fx_date: o.fx_date, error: o.error, missing: o.missing,
    effective_tnd_per_usable_t: round(o.cost?.effective_tnd_per_usable_t, 1), usable_yield_pct: round((o.cost?.usable_yield ?? 0) * 100, 2), landed_tnd_t: round(o.cost?.landed_tnd_t, 1),
    effective_formula: o.cost?.formula, reference: o.reference ? { grade: o.reference_grade, effective_tnd: round(o.reference.effective_tnd, 1), source: o.reference.source, date: o.reference.date } : undefined,
    quality_equivalence_pct: o.quality_equivalence_pct, ceiling: o.ceiling ? { max_price: round(o.ceiling.ceiling, 2), rule: o.ceiling.ceiling_rule, economic_ceiling: round(o.ceiling.economic_ceiling, 2), vp_nominal_cap: round(o.ceiling.vp_nominal_cap, 2), formula: o.ceiling.formula } : undefined,
    negotiation: o.negotiation ? { max_price: round(o.negotiation.max_price, 2), target_price: round(o.negotiation.target_price, 2), above_ceiling: o.negotiation.above_ceiling, savings_tnd_t: round(o.negotiation.expected_savings_tnd_t, 1), savings_tnd: round(o.negotiation.expected_savings_tnd, 0), rationale: o.negotiation.rationale } : undefined,
    competitor_offer_id: o.competitor_id,
  };
}

export const TOOLS: Record<string, ToolDef> = {
  get_dashboard_snapshot: {
    owner: 'reporting_forecasting',
    def: { name: 'get_dashboard_snapshot', description: 'Executive snapshot: record counts, latest cost/t per machine, best fibre offers, market trends, open alerts, pending decisions, savings totals and FX freshness.', input_schema: obj({}) },
    run: async (env) => { const d = await dashboardData(env); return { ...d, cost_trend: d.cost_trend.slice(-12) }; },
  },
  get_fx_rates: {
    owner: 'currency_risk',
    def: { name: 'get_fx_rates', description: 'Latest stored exchange rates (TND per unit) with date, source and age in days.', input_schema: obj({}) },
    run: async (env) => fxMap(env),
  },
  get_fibre_analysis: {
    owner: 'recovered_paper_analyst',
    def: { name: 'get_fibre_analysis', description: 'All current supplier offers (virgin pulp and recovered SWL/HWS/SOP) with effective fibre cost per usable tonne in TND, virgin pulp references, recovered-paper buying ceilings, negotiation targets, expected savings and supplier ranking per grade.', input_schema: obj({ grade: str('Optional grade filter, e.g. SWL, HWS, SOP, BEKP, NBSK') }) },
    run: async (env, i) => { const f = await fibreAnalysis(env, { grade: i.grade || undefined }); return { references: f.references, offers: f.offers.map(compactOffer), ranking: f.ranking, warnings: f.warnings, finance_params: f.settings }; },
  },
  get_supplier_ranking: {
    owner: 'procurement_analyst',
    def: { name: 'get_supplier_ranking', description: 'Validated, non-expired offers ranked by effective fibre cost per grade, with supplier quality/reliability ratings.', input_schema: obj({}) },
    run: async (env) => {
      const f = await fibreAnalysis(env);
      const sup = (await env.DB.prepare('SELECT id, name, country, quality_rating, reliability_rating, payment_terms_days FROM h360_suppliers WHERE active=1').all<any>()).results;
      return { ranking: f.ranking, suppliers: sup };
    },
  },
  get_market_prices: {
    owner: 'virgin_pulp_market',
    def: { name: 'get_market_prices', description: 'Validated market price history (virgin pulp and recovered grades) with source, basis, TND conversion and trend per grade.', input_schema: obj({ grade: str('Optional grade'), days: numb('Look-back window in days (default 365)') }) },
    run: async (env, i) => { const m = await marketSeries(env, i.grade || undefined, Math.min(Number(i.days) || 365, 1500)); return { trends: m.trends, series: Object.fromEntries(Object.entries(m.series).map(([g, l]) => [g, l.slice(-40).map((p: any) => ({ id: p.id, date: p.price_date, price: p.price, currency: p.currency, price_tnd: round(p.price_tnd, 1), basis: p.basis, source: p.source }))])) }; },
  },
  get_costing: {
    owner: 'manufacturing_cost_engineer',
    def: { name: 'get_costing', description: 'Validated Jumbo Roll costing periods for PM1/PM2: cost per saleable tonne, full cost, line-by-line breakdown, fibre & energy %, margins, break-even and target price, sensitivity.', input_schema: obj({ machine: str('PM1 or PM2', ['PM1', 'PM2']), product_grade: str('Optional product grade'), limit: numb('Number of periods (default 6)') }) },
    run: async (env, i) => (await costingPeriods(env, { machine: i.machine || undefined, grade: i.product_grade || undefined, limit: Math.min(Number(i.limit) || 6, 24) })).map((p) => ({
      period_id: p.id, machine: p.machine, period: `${p.period_start}..${p.period_end}`, product_grade: p.product_grade, saleable_t: p.saleable_t, downtime_h: p.downtime_h, rejects_t: p.rejects_t, avg_selling_price_tnd_t: p.avg_selling_price_tnd_t, error: p.error,
      result: p.result && { cost_per_saleable_t: round(p.result.cost_per_saleable_t, 1), full_cost_per_t: round(p.result.full_cost_per_t, 1), variable_cost_per_t: round(p.result.variable_cost_per_t, 1), fibre_pct: round(p.result.fibre_pct, 1), energy_pct: round(p.result.energy_pct, 1), recovered_mix_pct: round(p.result.fibre_mix_recovered_pct, 1), fibre_t_per_t: round(p.result.fibre_consumption_t_per_t, 3), kwh_per_t: round(p.result.kwh_per_t, 0), gross_margin_pct: round(p.result.gross_margin_pct, 1), contribution_tnd_t: round(p.result.contribution_margin_tnd_t, 1), break_even: round(p.result.break_even_price_tnd_t, 1), target_price: round(p.result.target_price_tnd_t, 1), lines: p.result.lines.map((l: any) => [l.label, round(l.tnd_t, 1)]), sensitivity: p.result.sensitivity.map((x: any) => [x.driver, round(x.delta_cost_t, 1)]) },
    })),
  },
  get_cost_variance: {
    owner: 'manufacturing_cost_engineer',
    def: { name: 'get_cost_variance', description: 'Explains the change in cost per tonne between the two latest validated periods of each machine: top cost-line drivers and KPI changes (kWh/t, rejects, fibre/t, downtime).', input_schema: obj({}) },
    run: async (env) => variance(await costingPeriods(env, { limit: 24 })),
  },
  get_energy_kpis: {
    owner: 'energy_optimization',
    def: { name: 'get_energy_kpis', description: 'Specific energy (kWh/t, Nm3 gas/t, t steam/t, m3 water/t), energy cost per tonne per period and machine, best recorded period and valued gap.', input_schema: obj({}) },
    run: async (env) => energyKpis(await costingPeriods(env, { limit: 24 })),
  },
  simulate_jumbo_price: {
    owner: 'pricing_strategist',
    def: { name: 'simulate_jumbo_price', description: 'Cost-to-sell simulation on a validated production period: applies fibre/energy/chemicals price changes and volume change; returns floor (variable cost), break-even, target price and margins at current/proposed/competitor prices.', input_schema: obj({ period_id: numb('Base production period id (from get_costing)'), fibre_price_change_pct: numb('e.g. -8'), energy_price_change_pct: numb(''), chemicals_change_pct: numb(''), volume_change_pct: numb(''), proposed_price_tnd_t: numb('Proposed selling price TND/t'), competitor_price_tnd_t: numb('Known competitor price TND/t') }, ['period_id']) },
    run: async (env, i) => {
      const [p] = (await costingPeriods(env, { limit: 500 })).filter((x) => x.id === Number(i.period_id));
      if (!p?.result) throw new Error('Période introuvable ou non validée');
      const s = await getSettings(env);
      return simulatePrice({ base: p.result, saleable_t: p.saleable_t, fibre_price_change_pct: Number(i.fibre_price_change_pct) || 0, energy_price_change_pct: Number(i.energy_price_change_pct) || 0, chemicals_change_pct: Number(i.chemicals_change_pct) || 0, volume_change_pct: Number(i.volume_change_pct) || 0, proposed_price_tnd_t: i.proposed_price_tnd_t ? Number(i.proposed_price_tnd_t) : null, current_price_tnd_t: p.avg_selling_price_tnd_t, competitor_price_tnd_t: i.competitor_price_tnd_t ? Number(i.competitor_price_tnd_t) : null, target_margin_pct: num(s, 'target_margin_pct', 12) });
    },
  },
  compute_ceiling: {
    owner: 'recovered_paper_analyst',
    def: { name: 'compute_ceiling', description: 'Hypothetical calculation: effective fibre cost, buying ceiling and negotiation target for a recovered-paper offer described by parameters, against the current validated virgin pulp reference.', input_schema: obj({ grade: str('SWL, HWS or SOP', ['SWL', 'HWS', 'SOP']), price: numb('Nominal price per tonne'), currency: str('TND, EUR or USD'), freight_tnd_t: numb(''), customs_pct: numb(''), processing_tnd_t: numb(''), energy_extra_tnd_t: numb(''), chemicals_extra_tnd_t: numb(''), moisture_pct: numb(''), contamination_pct: numb(''), process_loss_pct: numb(''), payment_terms_days: numb(''), quantity_t: numb('') }, ['grade', 'price', 'currency']) },
    run: async (env, i) => {
      const s = await getSettings(env);
      const fx = await fxMap(env);
      const f = fx[String(i.currency).toUpperCase()];
      if (!f) throw new Error(`Taux ${i.currency} manquant`);
      const fin = { cost_of_capital_pct: num(s, 'cost_of_capital_pct', 10), inventory_days: num(s, 'inventory_days', 30) };
      const input = { price: Number(i.price), currency: i.currency, fx_tnd: f.rate, freight_tnd_t: Number(i.freight_tnd_t) || 0, customs_pct: Number(i.customs_pct) || 0, handling_tnd_t: 0, processing_tnd_t: Number(i.processing_tnd_t) || 0, energy_extra_tnd_t: Number(i.energy_extra_tnd_t) || 0, chemicals_extra_tnd_t: Number(i.chemicals_extra_tnd_t) || 0, other_tnd_t: 0, moisture_pct: i.moisture_pct ?? 10, contamination_pct: Number(i.contamination_pct) || 0, process_loss_pct: Number(i.process_loss_pct) || 0, payment_terms_days: i.payment_terms_days ?? null };
      const refGrade = (s as any)[`vp_reference_${i.grade}`] || 'BEKP';
      const ref = (await fibreAnalysis(env)).references[refGrade];
      const cost = effectiveCost(input, fin);
      if (!ref) return { cost, missing: `Aucune référence ${refGrade} validée` };
      const ceiling = recoveredCeiling(input, fin, ref.effective_tnd, num(s, `quality_equivalence_${i.grade}`, 90), ref.nominal_tnd_t, false);
      return { cost, reference: ref, ceiling, negotiation: negotiationTarget(input.price, ceiling.ceiling, num(s, 'negotiation_margin_pct', 5), null, f.rate, i.quantity_t ? Number(i.quantity_t) : null) };
    },
  },
  get_savings: {
    owner: 'financial_controller',
    def: { name: 'get_savings', description: 'Savings opportunities register with projected vs realized TND by status and category, and the annual target.', input_schema: obj({}) },
    run: async (env) => ({ summary: await savingsSummary(env), items: (await env.DB.prepare('SELECT id, title, category, projected_tnd, realized_tnd, status, due_date, quality_validated FROM h360_savings ORDER BY id DESC LIMIT 50').all()).results }),
  },
  get_recommendations: {
    owner: 'reporting_forecasting',
    def: { name: 'get_recommendations', description: 'Existing recommendations and their approval status.', input_schema: obj({ status: str('proposed, approved, rejected, more_analysis', ['proposed', 'approved', 'rejected', 'more_analysis']) }) },
    run: async (env, i) => (await env.DB.prepare(`SELECT id, module, type, title, summary, savings_tnd, confidence, status, decision_note, created_by, created_at FROM h360_recommendations ${i.status ? 'WHERE status=?' : "WHERE status!='superseded'"} ORDER BY id DESC LIMIT 30`).bind(...(i.status ? [i.status] : [])).all()).results,
  },
  get_data_quality: {
    owner: 'data_integration',
    def: { name: 'get_data_quality', description: 'Data freshness and validation backlog: pending imports, unvalidated offers, inbound quotations, connector statuses, stale FX.', input_schema: obj({}) },
    run: async (env) => ({
      connectors: (await env.DB.prepare('SELECT id, enabled, status, last_ok_at, detail FROM h360_connectors').all()).results,
      pending_imports: (await env.DB.prepare("SELECT id, kind, filename, rows_total, rows_valid, created_at FROM h360_import_batches WHERE status='staged'").all()).results,
      pending_offers: (await env.DB.prepare("SELECT COUNT(*) n FROM h360_offers WHERE validation_status='pending' OR status='pending_validation'").first()),
      inbound: (await env.DB.prepare("SELECT id, channel, sender, subject, status, received_at FROM h360_inbound_docs WHERE status IN ('pending','extracted') LIMIT 20").all()).results,
      fx: await fxMap(env),
    }),
  },
  propose_recommendation: {
    owner: 'industrial_economist',
    def: { name: 'propose_recommendation', description: 'Record a quantified recommendation for Hanen\'s approval (status "proposed"). This does NOT execute anything externally.', input_schema: obj({
      module: str('Module', ['dashboard', 'purchasing', 'virgin_pulp', 'recovered', 'production', 'energy', 'pricing', 'savings']),
      title: str('Short actionable title'), summary: str('Recommendation and reason'), reasoning: str('Formula and calculation, step by step'),
      input_record_ids: { type: 'array', items: { type: 'string' }, description: 'Verified records used, e.g. "offer:12", "market_price:4", "production_period:7"' },
      savings_tnd: numb('Expected savings in TND (0 if not quantifiable)'), risks: str('Quality and production risks'),
      data_freshness: str('Dates of the data used'), confidence: numb('0..1'), missing_info: str('Missing information'),
    }, ['module', 'title', 'summary', 'reasoning', 'input_record_ids', 'savings_tnd', 'risks', 'data_freshness', 'confidence', 'missing_info']) },
    run: async (env, i, ctx) => {
      if (!['analyst', 'director', 'admin'].includes(ctx.user.role)) throw new Error('Permission insuffisante');
      const r = await upsertRecommendation(env, {
        slot: `ai:${ctx.agent}:${Date.now()}`, module: String(i.module), type: 'ai_analysis', title: String(i.title).slice(0, 200), summary: String(i.summary).slice(0, 2000), reasoning: String(i.reasoning).slice(0, 4000),
        inputs: { records: (i.input_record_ids || []).slice(0, 50), requested_by: ctx.user.email }, calc: { reasoning: String(i.reasoning).slice(0, 4000) },
        savings_tnd: Number(i.savings_tnd) || null, risks: String(i.risks).slice(0, 1500), data_freshness: String(i.data_freshness).slice(0, 500),
        confidence: Math.max(0, Math.min(1, Number(i.confidence) || 0)), missing_info: String(i.missing_info).slice(0, 1000), created_by: `agent:${ctx.agent}`,
      });
      return { recommendation_id: r.id, status: 'proposed', note: 'En attente de décision de Hanen (Approuver / Rejeter / Analyse complémentaire).' };
    },
  },
};
