/** Deterministic recommendation & alert engine (runs daily and on demand).
 *  Each recommendation carries its verified inputs, formulas, savings, risks,
 *  freshness, confidence and missing information. It never acts externally. */
import type { Env } from '../env';
import { getSettings, num } from '../lib/settings';
import { round, today } from '../lib/http';
import { costingPeriods, energyKpis, fibreAnalysis, latestByMachine, marketSeries, variance } from './data';

export interface RecoDraft {
  slot: string;
  module: string;
  type: string;
  title: string;
  summary: string;
  reasoning: string;
  inputs: unknown;
  calc: unknown;
  savings_tnd: number | null;
  risks: string;
  data_freshness: string;
  confidence: number;
  missing_info: string;
  created_by: string;
}

export async function upsertRecommendation(env: Env, r: RecoDraft): Promise<{ id: number; created: boolean }> {
  const fp = `${r.slot}|${round(r.savings_tnd ?? 0, 0)}|${JSON.stringify(r.calc).length}`;
  const exists = await env.DB.prepare('SELECT id FROM h360_recommendations WHERE fingerprint = ?').bind(fp).first<{ id: number }>();
  if (exists) return { id: exists.id, created: false };
  await env.DB.prepare(
    "UPDATE h360_recommendations SET status='superseded', updated_at=datetime('now') WHERE fingerprint LIKE ? AND status IN ('proposed','more_analysis')",
  ).bind(`${r.slot}|%`).run();
  const res = await env.DB.prepare(
    `INSERT INTO h360_recommendations (fingerprint, module, type, title, summary, reasoning, inputs_json, calc_json, savings_tnd, risks, data_freshness, confidence, missing_info, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(fp, r.module, r.type, r.title, r.summary, r.reasoning, JSON.stringify(r.inputs), JSON.stringify(r.calc), r.savings_tnd, r.risks, r.data_freshness, r.confidence, r.missing_info, r.created_by).run();
  return { id: Number(res.meta.last_row_id), created: true };
}

export async function raiseAlert(env: Env, a: { key: string; severity: 'info' | 'warning' | 'critical'; type: string; message: string; entity?: string; entity_id?: string | number }) {
  const r = await env.DB.prepare(
    'INSERT OR IGNORE INTO h360_alerts (fingerprint, severity, type, message, entity, entity_id) VALUES (?,?,?,?,?,?)',
  ).bind(a.key, a.severity, a.type, a.message, a.entity ?? null, a.entity_id === undefined ? null : String(a.entity_id)).run();
  return r.meta.changes > 0;
}

const fmt = (n: number | null | undefined, d = 0) => (n === null || n === undefined ? 'n.d.' : Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d }));

export async function runEngineScan(env: Env) {
  const s = await getSettings(env);
  const fibre = await fibreAnalysis(env);
  const periods = await costingPeriods(env, { limit: 48 });
  const market = await marketSeries(env, undefined, 400);
  const out = { recommendations_created: 0, alerts_created: 0, checked_offers: fibre.offers.length, checked_periods: periods.length };
  const add = async (r: RecoDraft) => { if ((await upsertRecommendation(env, r)).created) out.recommendations_created++; };
  const alert = async (a: Parameters<typeof raiseAlert>[1]) => { if (await raiseAlert(env, a)) out.alerts_created++; };

  // 1 ─ Offers: ceilings & negotiation targets
  for (const o of fibre.offers as any[]) {
    if (o.error) { await alert({ key: `offer-error:${o.id}:${o.error}`, severity: 'warning', type: 'donnée', message: `Offre #${o.id} (${o.supplier_name}, ${o.grade}) : ${o.error}`, entity: 'offer', entity_id: o.id }); continue; }
    if (o.expired && o.status === 'active') { await alert({ key: `offer-expired:${o.id}`, severity: 'info', type: 'offre', message: `Offre #${o.id} ${o.supplier_name} ${o.grade} expirée le ${o.valid_until}`, entity: 'offer', entity_id: o.id }); continue; }
    if (o.validation_status !== 'validated' || o.status === 'pending_validation' || !o.negotiation) continue;
    const n = o.negotiation;
    if (n.expected_savings_tnd_t <= 0.5) continue;
    const isRec = o.category === 'recovered';
    const freshness = `Offre du ${o.offer_date}; taux ${o.currency} du ${o.fx_date}${o.reference ? `; référence ${o.reference_grade} du ${o.reference.date} (${o.reference.age_days} j)` : ''}`;
    const missing: string[] = [];
    if (!o.quantity_t) missing.push('quantité de l’offre (économie totale non chiffrée)');
    if (o.quality_status !== 'approved') missing.push('validation qualité du lot');
    if (isRec && o.reference && o.reference.age_days > 30) missing.push('référence pâte vierge récente (> 30 j)');
    const conf = Math.max(0.3, 0.9 - missing.length * 0.15 - (o.reference?.record.table === 'h360_market_prices' ? 0.1 : 0));
    if (isRec && n.above_ceiling) {
      await alert({ key: `above-ceiling:${o.id}:${o.price}`, severity: 'critical', type: 'prix', message: `${o.supplier_name} ${o.grade} à ${fmt(o.price, 2)} ${o.currency}/t dépasse le plafond ${fmt(n.max_price, 2)} ${o.currency}/t`, entity: 'offer', entity_id: o.id });
    }
    await add({
      slot: `nego:offer:${o.id}`, module: isRec ? 'recovered' : 'virgin_pulp', type: 'negotiation',
      title: `${n.above_ceiling ? 'Refuser/renégocier' : 'Négocier'} ${o.grade} — ${o.supplier_name} : cible ${fmt(n.target_price, 2)} ${o.currency}/t`,
      summary: `Offre ${fmt(o.price, 2)} ${o.currency}/t → prix maximum ${fmt(n.max_price, 2)}, cible ${fmt(n.target_price, 2)} (${n.rationale}). Économie attendue ${fmt(n.expected_savings_tnd_t, 1)} TND/t${n.expected_savings_tnd ? `, soit ${fmt(n.expected_savings_tnd)} TND sur ${fmt(o.quantity_t)} t` : ''}.`,
      reasoning: isRec
        ? `Coût fibre effectif ${fmt(o.cost.effective_tnd_per_usable_t, 1)} TND/t utile (rendement ${fmt(o.cost.usable_yield * 100, 1)}%) vs ${o.reference_grade} ${fmt(o.reference.effective_tnd, 1)} TND/t utile × équivalence qualité ${o.quality_equivalence_pct}%. Règle plafond: ${o.ceiling.ceiling_rule === 'vp_nominal_cap' ? 'prix nominal ≤ référence pâte vierge' : 'parité de coût effectif'}.`
        : `Coût effectif ${fmt(o.cost.effective_tnd_per_usable_t, 1)} TND/t utile. Comparé à la meilleure offre concurrente${o.market_reference ? ' et au prix marché validé' : ''}.`,
      inputs: { offer_id: o.id, supplier_id: o.supplier_id, reference: o.reference?.record ?? null, competitor_offer_id: o.competitor_id, fx: { currency: o.currency, rate: o.fx_tnd, date: o.fx_date } },
      calc: { effective: o.cost.formula, ceiling: o.ceiling?.formula ?? null, breakdown: o.cost.breakdown.map((b: any) => [b.label, round(b.tnd_t, 2)]), max_price: round(n.max_price, 2), target_price: round(n.target_price, 2), savings_tnd_t: round(n.expected_savings_tnd_t, 2) },
      savings_tnd: n.expected_savings_tnd ? round(n.expected_savings_tnd, 0) : null,
      risks: isRec ? `Qualité: ${o.quality_gate}. Contaminants ${o.contamination_pct}%, humidité ${o.moisture_pct}%. Risque de rupture si le fournisseur refuse — vérifier alternatives classées.` : 'Risque de disponibilité / délai; exposition change ' + o.currency,
      data_freshness: freshness, confidence: round(conf, 2)!, missing_info: missing.join('; ') || 'aucune', created_by: 'engine:supplier_negotiation',
    });
  }

  // 2 ─ Virgin pulp market move → renegotiate recovered paper
  const th = num(s, 'alert_price_change_pct', 5);
  for (const [g, t] of Object.entries(market.trends) as [string, any][]) {
    if (t.change_pct === null || Math.abs(t.change_pct) < th) continue;
    await alert({ key: `market:${g}:${t.latest.id}`, severity: Math.abs(t.change_pct) >= 2 * th ? 'critical' : 'warning', type: 'marché', message: `${g} ${t.direction} de ${fmt(t.change_pct, 1)}% (${fmt(t.previous.price, 0)} → ${fmt(t.latest.price, 0)} ${t.latest.currency}, ${t.latest.source})`, entity: 'market_price', entity_id: t.latest.id });
    if (t.change_pct < 0) {
      const dependants = (fibre.offers as any[]).filter((o) => o.category === 'recovered' && o.reference_grade === g && o.negotiation && o.validation_status === 'validated');
      const total = dependants.reduce((a, o) => a + (o.negotiation.expected_savings_tnd ?? 0), 0);
      await add({
        slot: `market-drop:${g}`, module: 'recovered', type: 'renegotiation',
        title: `${g} en baisse de ${fmt(-t.change_pct, 1)}% : renégocier les achats recyclés indexés`,
        summary: `La baisse de la référence ${g} réduit le plafond économique de ${dependants.length} offre(s) recyclée(s). Économie potentielle chiffrée: ${fmt(total)} TND (offres avec quantité).`,
        reasoning: 'Le plafond recyclé est proportionnel au coût effectif de la pâte vierge de référence : une baisse de la référence abaisse mécaniquement le prix maximum acceptable.',
        inputs: { market_price_ids: [t.previous.id, t.latest.id], offer_ids: dependants.map((o) => o.id) },
        calc: { change_pct: round(t.change_pct, 2), offers: dependants.map((o) => ({ id: o.id, price: o.price, new_max: round(o.negotiation.max_price, 2), target: round(o.negotiation.target_price, 2) })) },
        savings_tnd: round(total, 0), risks: 'Fournisseurs peuvent invoquer coûts de collecte; sécuriser volumes avant de durcir la négociation.',
        data_freshness: `Prix marché du ${t.latest.price_date} (${t.latest.source})`, confidence: dependants.length ? 0.75 : 0.5,
        missing_info: dependants.length ? 'aucune' : 'aucune offre recyclée active liée à cette référence', created_by: 'engine:recovered_paper_analyst',
      });
    }
  }

  // 3 ─ Cost variance & pricing per machine
  const vt = num(s, 'alert_cost_variance_pct', 5);
  for (const v of variance(periods)) {
    if (Math.abs(v.delta_pct) < vt) continue;
    const top = v.drivers.slice(0, 3).map((d: any) => `${d.label} ${d.delta_t >= 0 ? '+' : ''}${fmt(d.delta_t, 1)} TND/t`).join(', ');
    await alert({ key: `variance:${v.machine}:${v.current_period}`, severity: v.delta_pct > 0 ? 'warning' : 'info', type: 'coût', message: `${v.machine} coût/t ${v.delta_pct > 0 ? '+' : ''}${fmt(v.delta_pct, 1)}% vs période précédente (${top})`, entity: 'production_period', entity_id: v.current_period });
    if (v.delta_pct > 0) {
      const cur = periods.find((p) => p.id === v.current_period);
      await add({
        slot: `variance:${v.machine}`, module: 'production', type: 'cost_variance',
        title: `${v.machine} : coût/t +${fmt(v.delta_pct, 1)}% — agir sur ${v.drivers[0].label}`,
        summary: `Coût par tonne vendable ${fmt(v.previous_cost_t, 1)} → ${fmt(v.current_cost_t, 1)} TND/t. Principaux écarts: ${top}.`,
        reasoning: 'Décomposition ligne à ligne du coût par tonne vendable entre les deux dernières périodes validées de la même machine.',
        inputs: { production_period_ids: [v.previous_period, v.current_period] }, calc: v,
        savings_tnd: round(v.delta_t * (cur?.saleable_t ?? 0), 0),
        risks: 'Écart pouvant provenir d’un changement de grade produit ou de mix fibre — vérifier avant action.',
        data_freshness: `Période close le ${cur?.period_end}`, confidence: 0.8, missing_info: 'causes opérationnelles (journal de bord machine)', created_by: 'engine:manufacturing_cost_engineer',
      });
    }
  }
  for (const [m, p] of Object.entries(latestByMachine(periods)) as [string, any][]) {
    const r = p.result;
    if (p.avg_selling_price_tnd_t && p.avg_selling_price_tnd_t < r.target_price_tnd_t) {
      const sev = p.avg_selling_price_tnd_t < r.break_even_price_tnd_t ? 'critical' : 'warning';
      await alert({ key: `price:${m}:${p.id}`, severity: sev, type: 'prix vente', message: `${m} ${p.product_grade}: prix moyen ${fmt(p.avg_selling_price_tnd_t)} TND/t ${sev === 'critical' ? 'sous le point mort' : 'sous la cible'} (${fmt(r.break_even_price_tnd_t)} / ${fmt(r.target_price_tnd_t)})`, entity: 'production_period', entity_id: p.id });
      await add({
        slot: `pricing:${m}:${p.product_grade}`, module: 'pricing', type: 'selling_price',
        title: `${m} ${p.product_grade} : prix plancher ${fmt(r.break_even_price_tnd_t)} TND/t, cible ${fmt(r.target_price_tnd_t)} TND/t`,
        summary: `Prix moyen réalisé ${fmt(p.avg_selling_price_tnd_t)} TND/t. Marge brute ${fmt(r.gross_margin_pct, 1)}%. Contribution ${fmt(r.contribution_margin_tnd_t)} TND/t.`,
        reasoning: `Point mort = coût complet ${fmt(r.full_cost_per_t, 1)} TND/t; cible = point mort / (1 − ${s.target_margin_pct}%).`,
        inputs: { production_period_id: p.id }, calc: { break_even: r.break_even_price_tnd_t, target: r.target_price_tnd_t, variable: r.variable_cost_per_t, current: p.avg_selling_price_tnd_t },
        savings_tnd: round((r.target_price_tnd_t - p.avg_selling_price_tnd_t) * p.saleable_t, 0),
        risks: 'Hausse de prix exposée à la concurrence — confronter aux prix concurrents saisis dans la simulation.',
        data_freshness: `Période ${p.period_start} → ${p.period_end}`, confidence: 0.7, missing_info: 'prix concurrents du marché local', created_by: 'engine:pricing_strategist',
      });
    }
  }

  // 4 ─ Energy gap to best recorded performance
  for (const [m, k] of Object.entries(energyKpis(periods)) as [string, any][]) {
    if (!k.latest || k.series.length < 2 || k.gap_to_best_tnd < 1000) continue;
    await add({
      slot: `energy:${m}`, module: 'energy', type: 'energy_saving',
      title: `${m} : revenir au meilleur coût énergie/t enregistré (${fmt(k.best.energy_cost_t, 1)} TND/t)`,
      summary: `Dernière période ${fmt(k.latest.energy_cost_t, 1)} TND/t (${fmt(k.latest.kwh_t, 0)} kWh/t, ${fmt(k.latest.steam_t, 2)} t vapeur/t). Écart valorisé: ${fmt(k.gap_to_best_tnd)} TND sur la période.`,
      reasoning: 'Benchmark interne: même machine, meilleure période validée. Gisement atteignable car déjà réalisé.',
      inputs: { best_period_id: k.best.period_id, latest_period_id: k.latest.period_id }, calc: { latest: k.latest, best: k.best },
      savings_tnd: round(k.gap_to_best_tnd, 0), risks: 'Grade produit ou grammage différents peuvent expliquer l’écart; valider avec la production.',
      data_freshness: `Période close le ${k.latest.period_end}`, confidence: k.latest.grade === k.best.grade ? 0.75 : 0.5,
      missing_info: k.latest.grade === k.best.grade ? 'aucune' : 'grades différents entre périodes comparées', created_by: 'engine:energy_optimization',
    });
  }

  // 5 ─ Data freshness alerts
  for (const [cur, f] of Object.entries(fibre.fx)) if (cur !== 'TND' && f.age_days > 3) await alert({ key: `fx-stale:${cur}:${f.date}`, severity: 'warning', type: 'donnée', message: `Taux ${cur}/TND non mis à jour depuis ${f.age_days} jours`, entity: 'fx', entity_id: cur });
  return out;
}

export async function supplierRanking(env: Env) {
  const f = await fibreAnalysis(env);
  return { generated_at: new Date().toISOString(), date: today(), ranking: f.ranking };
}
