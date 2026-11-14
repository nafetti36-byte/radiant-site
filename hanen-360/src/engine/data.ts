/** Loads verified records from D1 and runs the engines. Only validated records feed decisions. */
import type { Env } from '../env';
import { getSettings, num } from '../lib/settings';
import { daysBetween, round, today } from '../lib/http';
import { effectiveCost, equivalentPrice, negotiationTarget, recoveredCeiling, type OfferInput } from './fibre';
import { computePeriod, type CostResult, type PeriodInput } from './costing';

export const VP_GRADES = ['NBSK', 'BEKP', 'BHKP', 'BSKP', 'FLUFF', 'OTHER_VP'] as const;
export const RECOVERED_GRADES = ['SWL', 'HWS', 'SOP'] as const;

export interface FxInfo { rate: number; date: string; source: string; age_days: number }

export async function fxMap(env: Env): Promise<Record<string, FxInfo>> {
  const rows = await env.DB.prepare(
    `SELECT f.currency, f.rate_tnd, f.rate_date, f.source FROM h360_fx_rates f
       JOIN (SELECT currency, MAX(rate_date || fetched_at) AS k FROM h360_fx_rates GROUP BY currency) m
         ON m.currency = f.currency AND m.k = f.rate_date || f.fetched_at`,
  ).all<any>();
  const out: Record<string, FxInfo> = { TND: { rate: 1, date: today(), source: 'devise de base', age_days: 0 } };
  for (const r of rows.results) out[r.currency] = { rate: r.rate_tnd, date: r.rate_date, source: r.source, age_days: daysBetween(r.rate_date, today()) };
  return out;
}

function toOfferInput(o: any, fx: number): OfferInput {
  return {
    price: o.price, currency: o.currency, fx_tnd: fx,
    freight_tnd_t: o.freight_tnd_t ?? 0, customs_pct: o.customs_pct ?? 0, handling_tnd_t: o.handling_tnd_t ?? 0,
    processing_tnd_t: o.processing_tnd_t ?? 0, energy_extra_tnd_t: o.energy_extra_tnd_t ?? 0,
    chemicals_extra_tnd_t: o.chemicals_extra_tnd_t ?? 0, other_tnd_t: o.other_tnd_t ?? 0,
    moisture_pct: o.moisture_pct ?? 10, contamination_pct: o.contamination_pct ?? 0, process_loss_pct: o.process_loss_pct ?? 0,
    payment_terms_days: o.payment_terms_days ?? null,
  };
}

export interface VpReference {
  grade: string;
  effective_tnd: number;
  nominal_tnd_t: number;
  source: string;
  record: { table: string; id: number };
  date: string;
  age_days: number;
}

export async function fibreAnalysis(env: Env, filter: { grade?: string; include_inactive?: boolean } = {}) {
  const s = await getSettings(env);
  const fin = { cost_of_capital_pct: num(s, 'cost_of_capital_pct', 10), inventory_days: num(s, 'inventory_days', 30) };
  const fx = await fxMap(env);
  const warnings: string[] = [];

  const offers = (await env.DB.prepare(
    `SELECT o.*, s.name AS supplier_name, s.quality_rating, s.reliability_rating FROM h360_offers o
       JOIN h360_suppliers s ON s.id = o.supplier_id
      WHERE ${filter.include_inactive ? '1=1' : "o.status IN ('active','negotiating','pending_validation')"}
      ORDER BY o.offer_date DESC LIMIT 500`,
  ).all<any>()).results;

  const analysed = offers.map((o) => {
    const f = fx[o.currency];
    const base = { ...o, fx_tnd: f?.rate ?? null, fx_date: f?.date ?? null, expired: !!(o.valid_until && o.valid_until < today()) };
    if (!f) return { ...base, error: `Taux ${o.currency}/TND manquant — saisir ou importer le taux` };
    try {
      return { ...base, input: toOfferInput(o, f.rate), cost: effectiveCost(toOfferInput(o, f.rate), fin) };
    } catch (e: any) {
      return { ...base, error: e.message };
    }
  });

  const usable = (o: any) => o.cost && o.validation_status === 'validated' && !o.expired && o.status !== 'pending_validation';

  // ── Virgin pulp references (best validated live offer, else latest validated market price)
  const references: Record<string, VpReference> = {};
  for (const o of analysed.filter((x) => x.category === 'virgin_pulp' && usable(x))) {
    const cur = references[o.grade];
    if (!cur || o.cost.effective_tnd_per_usable_t < cur.effective_tnd) {
      references[o.grade] = {
        grade: o.grade, effective_tnd: o.cost.effective_tnd_per_usable_t, nominal_tnd_t: o.cost.nominal_tnd_t,
        source: `Offre #${o.id} — ${o.supplier_name}`, record: { table: 'h360_offers', id: o.id }, date: o.offer_date, age_days: daysBetween(o.offer_date, today()),
      };
    }
  }
  const market = (await env.DB.prepare(
    `SELECT m.* FROM h360_market_prices m JOIN (SELECT grade, MAX(price_date) d FROM h360_market_prices WHERE validation_status='validated' GROUP BY grade) x
       ON x.grade = m.grade AND x.d = m.price_date WHERE m.validation_status='validated' ORDER BY m.id DESC`,
  ).all<any>()).results;
  for (const m of market) {
    if (references[m.grade] || !(VP_GRADES as readonly string[]).includes(m.grade)) continue;
    const f = fx[m.currency];
    if (!f) { warnings.push(`Prix marché ${m.grade} en ${m.currency} sans taux de change`); continue; }
    const input: OfferInput = {
      price: m.price, currency: m.currency, fx_tnd: f.rate,
      freight_tnd_t: num(s, 'vp_default_freight_tnd_t'), customs_pct: num(s, 'vp_default_customs_pct'), handling_tnd_t: num(s, 'vp_default_handling_tnd_t'),
      processing_tnd_t: 0, energy_extra_tnd_t: 0, chemicals_extra_tnd_t: 0, other_tnd_t: 0,
      moisture_pct: num(s, 'vp_default_moisture_pct', 10), contamination_pct: 0, process_loss_pct: num(s, 'vp_default_process_loss_pct', 1), payment_terms_days: null,
    };
    const c = effectiveCost(input, fin);
    references[m.grade] = {
      grade: m.grade, effective_tnd: c.effective_tnd_per_usable_t, nominal_tnd_t: c.nominal_tnd_t,
      source: `Prix marché #${m.id} — ${m.source} (${m.basis || 'base n.c.'}) + logistique par défaut`, record: { table: 'h360_market_prices', id: m.id }, date: m.price_date, age_days: daysBetween(m.price_date, today()),
    };
  }

  // ── Recovered paper ceilings & negotiation targets
  const bestByGrade: Record<string, any> = {};
  for (const o of analysed.filter(usable)) {
    if (!bestByGrade[o.grade] || o.cost.effective_tnd_per_usable_t < bestByGrade[o.grade].cost.effective_tnd_per_usable_t) bestByGrade[o.grade] = o;
  }

  const result = analysed.map((o) => {
    if (!o.cost) return o;
    const competitor = Object.values(analysed).filter((x: any) => x.id !== o.id && x.grade === o.grade && usable(x))
      .sort((a: any, b: any) => a.cost.effective_tnd_per_usable_t - b.cost.effective_tnd_per_usable_t)[0] as any;
    const compEq = competitor ? equivalentPrice(o.input, fin, competitor.cost.effective_tnd_per_usable_t) : null;
    if (o.category === 'recovered') {
      const refGrade = s[`vp_reference_${o.grade}` as keyof typeof s] || 'BEKP';
      const ref = references[refGrade];
      const equiv = num(s, `quality_equivalence_${o.grade}`, 90);
      if (!ref) {
        return { ...o, competitor_id: competitor?.id ?? null, missing: `Aucune référence pâte vierge ${refGrade} validée : saisir un prix marché ou une offre` };
      }
      const ceiling = recoveredCeiling(o.input, fin, ref.effective_tnd, equiv, ref.nominal_tnd_t, !!o.ceiling_exception);
      const nego = negotiationTarget(o.price, ceiling.ceiling, num(s, 'negotiation_margin_pct', 5), compEq, o.fx_tnd, o.quantity_t);
      return {
        ...o, reference: ref, reference_grade: refGrade, quality_equivalence_pct: equiv, ceiling, negotiation: nego,
        competitor_id: competitor?.id ?? null, competitor_equivalent_price: compEq,
        vs_vp_effective_pct: ((o.cost.effective_tnd_per_usable_t - ref.effective_tnd) / ref.effective_tnd) * 100,
        quality_gate: o.quality_status === 'approved' ? 'ok' : 'Validation qualité requise avant toute substitution',
      };
    }
    // virgin pulp offer: negotiate against best competitor of same grade & market reference
    const mk = market.find((m: any) => m.grade === o.grade);
    let marketNominal: number | null = null;
    if (mk && fx[mk.currency]) marketNominal = (mk.price * fx[mk.currency].rate) / o.fx_tnd;
    const ceilingVp = Math.min(...[compEq, marketNominal].filter((x): x is number => x !== null && x > 0), o.price);
    const nego = negotiationTarget(o.price, ceilingVp, num(s, 'negotiation_margin_pct', 5), compEq, o.fx_tnd, o.quantity_t);
    return { ...o, competitor_id: competitor?.id ?? null, competitor_equivalent_price: compEq, market_reference: mk ?? null, market_nominal_in_offer_ccy: marketNominal, negotiation: nego };
  });

  const ranking: Record<string, any[]> = {};
  for (const o of result.filter(usable)) (ranking[o.grade] ||= []).push({
    offer_id: o.id, supplier_id: o.supplier_id, supplier: o.supplier_name, effective_tnd: round(o.cost.effective_tnd_per_usable_t, 1),
    price: o.price, currency: o.currency, quality_status: o.quality_status, above_ceiling: o.negotiation?.above_ceiling ?? false,
  });
  for (const g of Object.keys(ranking)) ranking[g].sort((a, b) => a.effective_tnd - b.effective_tnd);

  for (const c of new Set(offers.map((o) => o.currency))) {
    if (fx[c] && fx[c].age_days > 3 && c !== 'TND') warnings.push(`Taux ${c} daté de ${fx[c].age_days} jours (${fx[c].date})`);
  }

  const out = filter.grade ? result.filter((o) => o.grade === filter.grade) : result;
  return { settings: { fin, negotiation_margin_pct: num(s, 'negotiation_margin_pct', 5) }, fx, references, offers: out.map(stripInput), ranking, best: Object.fromEntries(Object.entries(bestByGrade).map(([g, o]) => [g, o.id])), warnings };
}

function stripInput(o: any) {
  const { input, ...rest } = o;
  return rest;
}

// ───────── Production costing ─────────
export async function costingPeriods(env: Env, filter: { machine?: string; grade?: string; from?: string; to?: string; limit?: number } = {}) {
  const s = await getSettings(env);
  const where: string[] = ["validation_status = 'validated'"];
  const binds: unknown[] = [];
  if (filter.machine) { where.push('machine = ?'); binds.push(filter.machine); }
  if (filter.grade) { where.push('product_grade = ?'); binds.push(filter.grade); }
  if (filter.from) { where.push('period_end >= ?'); binds.push(filter.from); }
  if (filter.to) { where.push('period_start <= ?'); binds.push(filter.to); }
  const rows = (await env.DB.prepare(`SELECT * FROM h360_production_periods WHERE ${where.join(' AND ')} ORDER BY period_end DESC LIMIT ?`)
    .bind(...binds, Math.min(filter.limit ?? 60, 500)).all<any>()).results;
  const tm = num(s, 'target_margin_pct', 12);
  return rows.map((r) => {
    try { return { ...r, computed_json: undefined, result: computePeriod(r as PeriodInput, tm) }; }
    catch (e: any) { return { ...r, computed_json: undefined, error: e.message }; }
  });
}

export function energyKpis(periods: any[]) {
  const byMachine: Record<string, any[]> = {};
  for (const p of periods.filter((x) => x.result)) (byMachine[p.machine] ||= []).push(p);
  const out: Record<string, any> = {};
  for (const [m, list] of Object.entries(byMachine)) {
    const series = list.slice().reverse().map((p) => ({
      period_id: p.id, period_end: p.period_end, grade: p.product_grade,
      kwh_t: p.result.kwh_per_t, gas_t: p.result.gas_nm3_per_t, steam_t: p.result.steam_t_per_t, water_t: p.result.water_m3_per_t,
      energy_cost_t: p.result.energy_tnd / p.saleable_t, energy_pct: p.result.energy_pct, reject_pct: p.result.reject_rate_pct,
      saleable_t: p.saleable_t,
    }));
    const latest = series[series.length - 1];
    const best = series.reduce((a, b) => (b.energy_cost_t < a.energy_cost_t ? b : a), series[0]);
    out[m] = {
      series, latest, best,
      // saving if latest period had matched the best recorded specific energy cost (same machine)
      gap_to_best_tnd: latest && best ? Math.max(0, (latest.energy_cost_t - best.energy_cost_t) * latest.saleable_t) : 0,
    };
  }
  return out;
}

export function variance(periods: any[]) {
  // latest vs previous period per machine: which cost lines drove the change in cost/t
  const out: any[] = [];
  for (const m of ['PM1', 'PM2']) {
    const list = periods.filter((p) => p.machine === m && p.result);
    if (list.length < 2) continue;
    const [cur, prev] = list;
    const lines = cur.result.lines.map((l: any) => {
      const pl = prev.result.lines.find((x: any) => x.key === l.key);
      return { key: l.key, label: l.label, current_t: l.tnd_t, previous_t: pl?.tnd_t ?? 0, delta_t: l.tnd_t - (pl?.tnd_t ?? 0) };
    }).sort((a: any, b: any) => Math.abs(b.delta_t) - Math.abs(a.delta_t));
    out.push({
      machine: m, current_period: cur.id, previous_period: prev.id,
      current_cost_t: cur.result.cost_per_saleable_t, previous_cost_t: prev.result.cost_per_saleable_t,
      delta_t: cur.result.cost_per_saleable_t - prev.result.cost_per_saleable_t,
      delta_pct: ((cur.result.cost_per_saleable_t - prev.result.cost_per_saleable_t) / prev.result.cost_per_saleable_t) * 100,
      drivers: lines.slice(0, 5),
      kpi_changes: {
        kwh_per_t: [prev.result.kwh_per_t, cur.result.kwh_per_t],
        reject_rate_pct: [prev.result.reject_rate_pct, cur.result.reject_rate_pct],
        fibre_consumption_t_per_t: [prev.result.fibre_consumption_t_per_t, cur.result.fibre_consumption_t_per_t],
        downtime_h: [prev.downtime_h, cur.downtime_h],
      },
    });
  }
  return out;
}

export async function marketSeries(env: Env, grade?: string, days = 365) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rows = (await env.DB.prepare(
    `SELECT * FROM h360_market_prices WHERE price_date >= ? ${grade ? 'AND grade = ?' : ''} AND validation_status='validated' ORDER BY price_date ASC`,
  ).bind(...(grade ? [since, grade] : [since])).all<any>()).results;
  const fx = await fxMap(env);
  const byGrade: Record<string, any[]> = {};
  for (const r of rows) (byGrade[r.grade] ||= []).push({ ...r, price_tnd: fx[r.currency] ? r.price * fx[r.currency].rate : null });
  const trends: Record<string, any> = {};
  for (const [g, list] of Object.entries(byGrade)) {
    const last = list[list.length - 1];
    const prev = list[list.length - 2];
    const first = list[0];
    trends[g] = {
      latest: last, previous: prev ?? null,
      change_pct: prev ? ((last.price - prev.price) / prev.price) * 100 : null,
      change_period_pct: list.length > 1 ? ((last.price - first.price) / first.price) * 100 : null,
      points: list.length,
      direction: !prev ? 'inconnu' : last.price < prev.price ? 'baisse' : last.price > prev.price ? 'hausse' : 'stable',
    };
  }
  return { series: byGrade, trends };
}

export async function savingsSummary(env: Env) {
  const s = await getSettings(env);
  const rows = (await env.DB.prepare('SELECT status, category, SUM(projected_tnd) p, SUM(realized_tnd) r, COUNT(*) n FROM h360_savings GROUP BY status, category').all<any>()).results;
  const totals = { projected: 0, validated_projected: 0, realized: 0, count: 0 };
  for (const r of rows) {
    if (r.status !== 'rejected') totals.projected += r.p || 0;
    if (['validated', 'in_progress', 'realized'].includes(r.status)) totals.validated_projected += r.p || 0;
    totals.realized += r.r || 0;
    totals.count += r.n;
  }
  return { by: rows, totals, annual_target_tnd: num(s, 'annual_savings_target_tnd') };
}

export function latestByMachine(periods: any[]) {
  const out: Record<string, any> = {};
  for (const p of periods) if (p.result && !out[p.machine]) out[p.machine] = p;
  return out;
}

export type { CostResult };
