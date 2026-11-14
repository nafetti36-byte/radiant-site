/** Free built-in assistant (no external AI): answers the key management questions directly
 *  from validated records with the pricing & costing engines. Deterministic, explainable. */
import type { Env } from '../env';
import { costingPeriods, energyKpis, fibreAnalysis, latestByMachine, marketSeries, savingsSummary, variance, RECOVERED_GRADES } from './data';
import { simulatePrice } from './costing';
import { recoveredCeiling, negotiationTarget, type OfferInput } from './fibre';
import { getSettings, num } from '../lib/settings';

export type Lang = 'fr' | 'en' | 'ar';
export interface Answer {
  intent: string;
  title: string;
  verdict: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
  points: string[];
  table?: { head: string[]; rows: (string | number)[][] };
  formula?: string;
  sources: string[];
  missing: string[];
  savings_tnd?: number | null;
  module: string;
  confidence: number;
}

const T: Record<string, Record<Lang, string>> = {
  no_data: { fr: 'Données insuffisantes', en: 'Not enough data', ar: 'بيانات غير كافية' },
  add_offers: { fr: 'Ajoutez des offres validées (Achats → Offres)', en: 'Add validated offers (Purchasing → Offers)', ar: 'أضف عروضًا معتمدة (المشتريات ← العروض)' },
  add_market: { fr: 'Ajoutez un prix marché de la pâte de référence (Pâte vierge → Ajouter)', en: 'Add a reference pulp market price (Virgin pulp → Add)', ar: 'أضف سعر سوق مرجعي للب (اللب البكر ← إضافة)' },
  add_periods: { fr: 'Saisissez au moins une période de production validée', en: 'Enter at least one validated production period', ar: 'أدخل فترة إنتاج معتمدة واحدة على الأقل' },
  add_two_periods: { fr: 'Il faut deux périodes validées de la même machine', en: 'Two validated periods of the same machine are needed', ar: 'يلزم فترتان معتمدتان لنفس الآلة' },
  quality_gate: { fr: 'Aucune substitution sans validation qualité.', en: 'No substitution without quality validation.', ar: 'لا استبدال دون اعتماد الجودة.' },
};
const tr = (k: string, l: Lang) => T[k]?.[l] ?? T[k]?.fr ?? k;
const L3 = (l: Lang, fr: string, en: string, ar: string) => (l === 'en' ? en : l === 'ar' ? ar : fr);
const f0 = (n: number | null | undefined, d = 0) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ | /g, ' '));

function empty(intent: string, l: Lang, title: string, missing: string[], module: string): Answer {
  return { intent, title, verdict: tr('no_data', l), tone: 'warn', points: [], sources: [], missing, module, confidence: 0 };
}

// ── 1. Maximum price for a grade
async function maxPrice(env: Env, l: Lang, grade: string): Promise<Answer> {
  const f = await fibreAnalysis(env);
  const title = L3(l, `Prix maximum ${grade} à payer aujourd’hui`, `Maximum ${grade} price to pay today`, `أقصى سعر ${grade} يجب دفعه اليوم`);
  const offers = (f.offers as any[]).filter((o) => o.grade === grade && o.negotiation && o.validation_status === 'validated' && !o.expired && o.status !== 'pending_validation');
  const isRec = (RECOVERED_GRADES as readonly string[]).includes(grade);
  if (!offers.length) {
    const missing = [tr('add_offers', l)];
    if (isRec) {
      const s = await getSettings(env);
      if (!f.references[(s as any)[`vp_reference_${grade}`] || 'BEKP']) missing.push(tr('add_market', l));
    }
    return empty('max_price', l, title, missing, isRec ? 'recovered' : 'virgin_pulp');
  }
  offers.sort((a, b) => a.cost.effective_tnd_per_usable_t - b.cost.effective_tnd_per_usable_t);
  const above = offers.filter((o) => o.negotiation.above_ceiling && isRec);
  const best = offers[0];
  const totalSavings = offers.reduce((a, o) => a + (o.negotiation.expected_savings_tnd ?? 0), 0);
  const points = offers.map((o) => L3(l,
    `${o.supplier_name} : offre ${f0(o.price, 2)} ${o.currency}/t → max ${f0(o.negotiation.max_price, 2)}, cible ${f0(o.negotiation.target_price, 2)} ${o.currency}/t${o.negotiation.above_ceiling && isRec ? ' — AU-DESSUS DU PLAFOND' : ''}`,
    `${o.supplier_name}: offer ${f0(o.price, 2)} ${o.currency}/t → max ${f0(o.negotiation.max_price, 2)}, target ${f0(o.negotiation.target_price, 2)} ${o.currency}/t${o.negotiation.above_ceiling && isRec ? ' — ABOVE CEILING' : ''}`,
    `${o.supplier_name}: العرض ${f0(o.price, 2)} ${o.currency}/طن ← الأقصى ${f0(o.negotiation.max_price, 2)}، المستهدف ${f0(o.negotiation.target_price, 2)}${o.negotiation.above_ceiling && isRec ? ' — فوق السقف' : ''}`));
  const verdict = isRec
    ? L3(l, `Ne pas dépasser ${f0(best.negotiation.max_price, 2)} ${best.currency}/t pour ${grade} (offre la plus compétitive : ${best.supplier_name}). Viser ${f0(best.negotiation.target_price, 2)} ${best.currency}/t.`,
      `Do not exceed ${f0(best.negotiation.max_price, 2)} ${best.currency}/t for ${grade} (most competitive offer: ${best.supplier_name}). Target ${f0(best.negotiation.target_price, 2)} ${best.currency}/t.`,
      `لا تتجاوز ${f0(best.negotiation.max_price, 2)} ${best.currency}/طن لـ ${grade} (أفضل عرض: ${best.supplier_name}). استهدف ${f0(best.negotiation.target_price, 2)}.`)
    : L3(l, `Meilleur coût effectif ${grade} : ${best.supplier_name} à ${f0(best.cost.effective_tnd_per_usable_t)} TND/t utile. Viser ${f0(best.negotiation.target_price, 2)} ${best.currency}/t.`,
      `Best ${grade} effective cost: ${best.supplier_name} at ${f0(best.cost.effective_tnd_per_usable_t)} TND/usable t. Target ${f0(best.negotiation.target_price, 2)} ${best.currency}/t.`,
      `أفضل تكلفة فعلية لـ ${grade}: ${best.supplier_name} بـ ${f0(best.cost.effective_tnd_per_usable_t)} دينار/طن صافٍ.`);
  return {
    intent: 'max_price', title, verdict, tone: above.length ? 'bad' : 'ok', points,
    table: { head: [L3(l, 'Fournisseur', 'Supplier', 'المورد'), L3(l, 'Offre', 'Offer', 'العرض'), L3(l, 'Coût effectif TND/t utile', 'Effective TND/usable t', 'التكلفة الفعلية'), L3(l, 'Maximum', 'Maximum', 'الأقصى'), L3(l, 'Cible', 'Target', 'المستهدف')],
      rows: offers.map((o) => [o.supplier_name, `${f0(o.price, 2)} ${o.currency}`, f0(o.cost.effective_tnd_per_usable_t), f0(o.negotiation.max_price, 2), f0(o.negotiation.target_price, 2)]) },
    formula: best.ceiling?.formula ?? best.cost.formula,
    sources: [...offers.map((o) => `offre #${o.id} (${o.offer_date})`), ...(best.reference ? [best.reference.source] : []), ...Object.entries(f.fx).filter(([c]) => offers.some((o) => o.currency === c) && c !== 'TND').map(([c, v]) => `${c} ${v.rate} (${v.date})`)],
    missing: offers.some((o) => o.quality_status !== 'approved') && isRec ? [tr('quality_gate', l)] : [],
    savings_tnd: totalSavings || null, module: isRec ? 'recovered' : 'virgin_pulp', confidence: best.reference?.record?.table === 'h360_market_prices' ? 0.7 : 0.85,
  };
}

// ── 2. Best supplier (lowest effective fibre cost)
async function bestSupplier(env: Env, l: Lang): Promise<Answer> {
  const f = await fibreAnalysis(env);
  const title = L3(l, 'Quel fournisseur offre le coût fibre effectif le plus bas ?', 'Which supplier gives the lowest effective fibre cost?', 'أي مورد يقدم أقل تكلفة فعلية للألياف؟');
  const grades = Object.keys(f.ranking);
  if (!grades.length) return empty('best_supplier', l, title, [tr('add_offers', l)], 'purchasing');
  const all = grades.flatMap((g) => f.ranking[g].map((r) => ({ ...r, grade: g })));
  all.sort((a, b) => a.effective_tnd - b.effective_tnd);
  const top = all[0];
  return {
    intent: 'best_supplier', title, tone: 'ok', module: 'purchasing', confidence: 0.85,
    verdict: L3(l, `${top.supplier} (${top.grade}) : ${f0(top.effective_tnd)} TND par tonne de fibre utile — le plus bas de toutes les offres validées.`, `${top.supplier} (${top.grade}): ${f0(top.effective_tnd)} TND per usable tonne — the lowest of all validated offers.`, `${top.supplier} (${top.grade}): ${f0(top.effective_tnd)} دينار لكل طن ألياف صافٍ — الأدنى.`),
    points: grades.map((g) => `${g} : ${f.ranking[g].map((r, i) => `${i + 1}. ${r.supplier} ${f0(r.effective_tnd)}`).join(' · ')}`),
    table: { head: ['Grade', L3(l, 'Fournisseur', 'Supplier', 'المورد'), L3(l, 'TND/t utile', 'TND/usable t', 'دينار/طن صافٍ'), L3(l, 'Prix', 'Price', 'السعر'), L3(l, 'Qualité', 'Quality', 'الجودة')], rows: all.map((r) => [r.grade, r.supplier, f0(r.effective_tnd), `${f0(r.price, 2)} ${r.currency}`, r.quality_status]) },
    formula: '(prix × change + douane + fret + traitement + énergie + chimie + financement) / rendement fibre utile',
    sources: all.map((r) => `offre #${r.offer_id}`), missing: all.some((r) => r.quality_status !== 'approved') ? [tr('quality_gate', l)] : [],
  };
}

// ── 3. Why did cost per tonne increase?
async function costIncrease(env: Env, l: Lang, machine: string): Promise<Answer> {
  const periods = await costingPeriods(env, { machine, limit: 12 });
  const title = L3(l, `Pourquoi le coût par tonne de ${machine} a-t-il évolué ?`, `Why did ${machine} cost per tonne change?`, `لماذا تغيرت تكلفة الطن في ${machine}؟`);
  const v = variance(periods).find((x) => x.machine === machine);
  if (!v) return empty('cost_increase', l, title, [tr('add_two_periods', l)], 'production');
  const cur = periods.find((p) => p.id === v.current_period), prev = periods.find((p) => p.id === v.previous_period);
  const up = v.delta_t > 0;
  const drivers = v.drivers.filter((d: any) => Math.abs(d.delta_t) >= 0.5).slice(0, 5);
  const k = v.kpi_changes;
  const kpiPts: string[] = [];
  if (k.kwh_per_t[0] && k.kwh_per_t[1]) kpiPts.push(L3(l, `Électricité : ${f0(k.kwh_per_t[0])} → ${f0(k.kwh_per_t[1])} kWh/t`, `Electricity: ${f0(k.kwh_per_t[0])} → ${f0(k.kwh_per_t[1])} kWh/t`, `الكهرباء: ${f0(k.kwh_per_t[0])} ← ${f0(k.kwh_per_t[1])} ك.و.س/طن`));
  if (k.reject_rate_pct[0] !== null && k.reject_rate_pct[1] !== null) kpiPts.push(L3(l, `Rebuts : ${f0(k.reject_rate_pct[0], 1)} % → ${f0(k.reject_rate_pct[1], 1)} %`, `Rejects: ${f0(k.reject_rate_pct[0], 1)}% → ${f0(k.reject_rate_pct[1], 1)}%`, `المرفوضات: ${f0(k.reject_rate_pct[0], 1)}% ← ${f0(k.reject_rate_pct[1], 1)}%`));
  if (k.downtime_h[0] !== k.downtime_h[1]) kpiPts.push(L3(l, `Arrêts : ${f0(k.downtime_h[0])} h → ${f0(k.downtime_h[1])} h`, `Downtime: ${f0(k.downtime_h[0])} h → ${f0(k.downtime_h[1])} h`, `التوقفات: ${f0(k.downtime_h[0])} ← ${f0(k.downtime_h[1])} س`));
  if (k.fibre_consumption_t_per_t[0] && k.fibre_consumption_t_per_t[1]) kpiPts.push(L3(l, `Fibre consommée : ${f0(k.fibre_consumption_t_per_t[0], 3)} → ${f0(k.fibre_consumption_t_per_t[1], 3)} t/t`, `Fibre use: ${f0(k.fibre_consumption_t_per_t[0], 3)} → ${f0(k.fibre_consumption_t_per_t[1], 3)} t/t`, `استهلاك الألياف: ${f0(k.fibre_consumption_t_per_t[0], 3)} ← ${f0(k.fibre_consumption_t_per_t[1], 3)}`));
  const main = drivers[0];
  return {
    intent: 'cost_increase', title, module: 'production', confidence: cur.product_grade === prev.product_grade ? 0.85 : 0.6,
    tone: up ? 'bad' : 'ok',
    verdict: L3(l, `Coût par tonne vendable ${f0(v.previous_cost_t, 1)} → ${f0(v.current_cost_t, 1)} TND (${up ? '+' : ''}${f0(v.delta_pct, 1)} %). Premier facteur : ${main?.label ?? '—'} (${main ? (main.delta_t > 0 ? '+' : '') + f0(main.delta_t, 1) : '—'} TND/t).`,
      `Cost per saleable tonne ${f0(v.previous_cost_t, 1)} → ${f0(v.current_cost_t, 1)} TND (${up ? '+' : ''}${f0(v.delta_pct, 1)}%). Main driver: ${main?.label ?? '—'} (${main ? (main.delta_t > 0 ? '+' : '') + f0(main.delta_t, 1) : '—'} TND/t).`,
      `تكلفة الطن ${f0(v.previous_cost_t, 1)} ← ${f0(v.current_cost_t, 1)} دينار (${f0(v.delta_pct, 1)}%). العامل الرئيسي: ${main?.label ?? '—'}.`),
    points: [...drivers.map((d: any) => `${d.label} : ${f0(d.previous_t, 1)} → ${f0(d.current_t, 1)} TND/t (${d.delta_t > 0 ? '+' : ''}${f0(d.delta_t, 1)})`), ...kpiPts],
    formula: L3(l, 'Écart = Σ (coût du poste / tonnage vendable) période actuelle − période précédente', 'Variance = Σ (line cost / saleable t) current − previous', 'الفرق = مجموع (تكلفة البند / الطن القابل للبيع) الحالي − السابق'),
    sources: [`période #${prev.id} (${prev.period_start} → ${prev.period_end})`, `période #${cur.id} (${cur.period_start} → ${cur.period_end})`],
    missing: cur.product_grade !== prev.product_grade ? [L3(l, `Grades différents (${prev.product_grade} / ${cur.product_grade}) : comparaison à interpréter avec prudence`, `Different grades (${prev.product_grade} / ${cur.product_grade}): interpret with care`, `درجات مختلفة: يُفسَّر بحذر`)] : [],
    savings_tnd: up ? Math.round(v.delta_t * cur.saleable_t) : null,
  };
}

// ── 4. Can we change the Jumbo Roll selling price by X %?
async function priceChange(env: Env, l: Lang, machine: string, pctChange: number): Promise<Answer> {
  const s = await getSettings(env);
  const periods = await costingPeriods(env, { machine, limit: 6 });
  const p = periods.find((x) => x.result);
  const title = L3(l, `Peut-on ${pctChange < 0 ? 'baisser' : 'augmenter'} le prix du Jumbo Roll ${machine} de ${f0(Math.abs(pctChange), 1)} % ?`, `Can we ${pctChange < 0 ? 'reduce' : 'raise'} ${machine} Jumbo Roll price by ${f0(Math.abs(pctChange), 1)}%?`, `هل يمكن تعديل سعر بكرة ${machine} بنسبة ${f0(pctChange, 1)}%؟`);
  if (!p) return empty('price_change', l, title, [tr('add_periods', l)], 'pricing');
  if (!p.avg_selling_price_tnd_t) return empty('price_change', l, title, [L3(l, 'Saisissez le prix de vente moyen dans la période de production', 'Enter the average selling price in the production period', 'أدخل متوسط سعر البيع في فترة الإنتاج')], 'pricing');
  const current = p.avg_selling_price_tnd_t, proposed = current * (1 + pctChange / 100);
  const tm = num(s, 'target_margin_pct', 12);
  const r = simulatePrice({ base: p.result, saleable_t: p.saleable_t, fibre_price_change_pct: 0, energy_price_change_pct: 0, chemicals_change_pct: 0, volume_change_pct: 0, proposed_price_tnd_t: proposed, current_price_tnd_t: current, competitor_price_tnd_t: null, target_margin_pct: tm });
  const ok = proposed >= r.target_price_t, risky = proposed < r.break_even_price_t;
  const neededVolume = r.at_proposed_price && r.at_current_price && r.at_proposed_price.contribution_tnd_t > 0 ? ((r.at_current_price.profit_tnd + p.result.fixed_tnd) / r.at_proposed_price.contribution_tnd_t) : null;
  return {
    intent: 'price_change', title, module: 'pricing', confidence: 0.8,
    tone: risky ? 'bad' : ok ? 'ok' : 'warn',
    verdict: L3(l,
      `${risky ? 'NON' : ok ? 'OUI' : 'POSSIBLE MAIS RISQUÉ'} : ${f0(current)} → ${f0(proposed)} TND/t. Point mort ${f0(r.break_even_price_t)} TND/t, prix cible ${f0(r.target_price_t)} TND/t. Effet sur le profit de la période : ${r.profit_delta_tnd! >= 0 ? '+' : ''}${f0(r.profit_delta_tnd)} TND.`,
      `${risky ? 'NO' : ok ? 'YES' : 'POSSIBLE BUT RISKY'}: ${f0(current)} → ${f0(proposed)} TND/t. Break-even ${f0(r.break_even_price_t)} TND/t, target ${f0(r.target_price_t)} TND/t. Profit impact for the period: ${f0(r.profit_delta_tnd)} TND.`,
      `${risky ? 'لا' : ok ? 'نعم' : 'ممكن لكن بمخاطرة'}: ${f0(current)} ← ${f0(proposed)} دينار/طن. نقطة التعادل ${f0(r.break_even_price_t)}، المستهدف ${f0(r.target_price_t)}. أثر الربح: ${f0(r.profit_delta_tnd)} دينار.`),
    points: [
      L3(l, `Marge actuelle : ${f0(r.at_current_price?.margin_pct, 1)} % → après changement : ${f0(r.at_proposed_price?.margin_pct, 1)} %`, `Current margin: ${f0(r.at_current_price?.margin_pct, 1)}% → after: ${f0(r.at_proposed_price?.margin_pct, 1)}%`, `الهامش الحالي ${f0(r.at_current_price?.margin_pct, 1)}% ← بعد التغيير ${f0(r.at_proposed_price?.margin_pct, 1)}%`),
      L3(l, `Plancher absolu (coût variable) : ${f0(r.floor_price_short_term_t)} TND/t`, `Absolute floor (variable cost): ${f0(r.floor_price_short_term_t)} TND/t`, `الحد الأدنى المطلق: ${f0(r.floor_price_short_term_t)} دينار/طن`),
      ...(neededVolume && pctChange < 0 ? [L3(l, `Pour garder le même profit, il faudrait vendre ≈ ${f0(neededVolume)} t au lieu de ${f0(p.saleable_t)} t`, `To keep the same profit you would need to sell ≈ ${f0(neededVolume)} t instead of ${f0(p.saleable_t)} t`, `للحفاظ على نفس الربح يجب بيع ≈ ${f0(neededVolume)} طن`)] : []),
      L3(l, 'Ne publie aucun prix : décision et publication restent à la Direction.', 'No price is published: decision and publication remain with management.', 'لا يُنشر أي سعر: القرار للإدارة.'),
    ],
    formula: `${L3(l, 'Point mort', 'Break-even', 'نقطة التعادل')} = ${L3(l, 'coût complet', 'full cost', 'التكلفة الكاملة')} / t ; ${L3(l, 'cible', 'target', 'المستهدف')} = ${L3(l, 'point mort', 'break-even', 'التعادل')} / (1 − ${tm} %)`,
    sources: [`période #${p.id} ${p.machine} ${p.product_grade} (${p.period_start} → ${p.period_end})`], missing: [L3(l, 'Prix des concurrents (à saisir dans Prix Jumbo Roll pour comparer)', 'Competitor prices (enter in Jumbo Roll Pricing to compare)', 'أسعار المنافسين')],
    savings_tnd: null,
  };
}

// ── 5. Virgin pulp dropped X % — should we renegotiate recovered paper?
async function pulpDrop(env: Env, l: Lang, dropPct: number): Promise<Answer> {
  const f = await fibreAnalysis(env);
  const s = await getSettings(env);
  const title = L3(l, `La pâte vierge a baissé de ${f0(dropPct, 1)} % : faut-il renégocier les papiers recyclés ?`, `Virgin pulp fell ${f0(dropPct, 1)}%: renegotiate recovered paper?`, `انخفض اللب البكر ${f0(dropPct, 1)}%: هل نعيد التفاوض؟`);
  const rec = (f.offers as any[]).filter((o) => o.category === 'recovered' && o.ceiling && o.validation_status === 'validated' && !o.expired);
  if (!rec.length) return empty('pulp_drop', l, title, [tr('add_offers', l), tr('add_market', l)], 'recovered');
  const fin = f.settings.fin;
  let total = 0;
  const rows = rec.map((o) => {
    const ref = o.reference;
    const newEff = ref.effective_tnd * (1 - dropPct / 100);
    const input: OfferInput = { price: o.price, currency: o.currency, fx_tnd: o.fx_tnd, freight_tnd_t: o.freight_tnd_t, customs_pct: o.customs_pct, handling_tnd_t: o.handling_tnd_t, processing_tnd_t: o.processing_tnd_t, energy_extra_tnd_t: o.energy_extra_tnd_t, chemicals_extra_tnd_t: o.chemicals_extra_tnd_t, other_tnd_t: o.other_tnd_t, moisture_pct: o.moisture_pct, contamination_pct: o.contamination_pct, process_loss_pct: o.process_loss_pct, payment_terms_days: o.payment_terms_days };
    const c = recoveredCeiling(input, fin, newEff, o.quality_equivalence_pct, ref.nominal_tnd_t * (1 - dropPct / 100), !!o.ceiling_exception);
    const n = negotiationTarget(o.price, c.ceiling, num(s, 'negotiation_margin_pct', 5), o.competitor_equivalent_price, o.fx_tnd, o.quantity_t);
    total += n.expected_savings_tnd ?? 0;
    return { o, oldMax: o.ceiling.ceiling, newMax: c.ceiling, n };
  });
  const above = rows.filter((r) => r.o.price > r.newMax);
  return {
    intent: 'pulp_drop', title, module: 'recovered', confidence: 0.75, tone: above.length ? 'bad' : 'info',
    verdict: above.length
      ? L3(l, `OUI. Avec une pâte −${f0(dropPct, 1)} %, ${above.length} offre(s) recyclée(s) dépassent le nouveau plafond. Économie chiffrée : ${f0(total)} TND.`, `YES. With pulp −${f0(dropPct, 1)}%, ${above.length} recovered offer(s) exceed the new ceiling. Quantified savings: ${f0(total)} TND.`, `نعم. مع انخفاض اللب ${f0(dropPct, 1)}%، ${above.length} عرض(عروض) فوق السقف الجديد. التوفير: ${f0(total)} دينار.`)
      : L3(l, `Pas d’urgence : les offres restent sous le nouveau plafond, mais la cible de négociation baisse (économie possible ${f0(total)} TND).`, `No urgency: offers stay under the new ceiling, but the negotiation target drops (possible savings ${f0(total)} TND).`, `لا استعجال: العروض تحت السقف الجديد، لكن الهدف ينخفض (توفير ممكن ${f0(total)} دينار).`),
    points: rows.map((r) => `${r.o.supplier_name} ${r.o.grade} : ${f0(r.o.price, 2)} ${r.o.currency} — ${L3(l, 'plafond', 'ceiling', 'السقف')} ${f0(r.oldMax, 2)} → ${f0(r.newMax, 2)}, ${L3(l, 'cible', 'target', 'المستهدف')} ${f0(r.n.target_price, 2)}`),
    table: { head: [L3(l, 'Fournisseur', 'Supplier', 'المورد'), 'Grade', L3(l, 'Offre', 'Offer', 'العرض'), L3(l, 'Plafond actuel', 'Current ceiling', 'السقف الحالي'), L3(l, 'Nouveau plafond', 'New ceiling', 'السقف الجديد'), L3(l, 'Économie TND', 'Savings TND', 'التوفير')], rows: rows.map((r) => [r.o.supplier_name, r.o.grade, f0(r.o.price, 2), f0(r.oldMax, 2), f0(r.newMax, 2), f0(r.n.expected_savings_tnd)]) },
    formula: L3(l, 'Nouveau plafond : même formule avec le coût effectif de la pâte de référence × (1 − baisse)', 'New ceiling: same formula with reference pulp effective cost × (1 − drop)', 'السقف الجديد: نفس المعادلة مع خفض تكلفة اللب المرجعي'),
    sources: [...new Set(rec.map((o) => o.reference.source))].concat(rec.map((o) => `offre #${o.id}`)), missing: rows.some((r) => !r.o.quantity_t) ? [L3(l, 'Quantités manquantes sur certaines offres (économie totale incomplète)', 'Missing quantities on some offers', 'كميات ناقصة في بعض العروض')] : [],
    savings_tnd: Math.round(total) || null,
  };
}

// ── 6. Where can we save money (optionally to reach a target)?
async function savingsIdeas(env: Env, l: Lang, target: number | null): Promise<Answer> {
  const [f, periods, sav] = await Promise.all([fibreAnalysis(env), costingPeriods(env, { limit: 24 }), savingsSummary(env)]);
  const title = target ? L3(l, `Comment économiser ${f0(target)} TND sans réduire la qualité ?`, `How to save ${f0(target)} TND without reducing quality?`, `كيف نوفر ${f0(target)} دينار دون المساس بالجودة؟`) : L3(l, 'Où pouvons-nous économiser ?', 'Where can we save money?', 'أين يمكننا التوفير؟');
  const ideas: { label: string; tnd: number; src: string; quality: boolean }[] = [];
  for (const o of f.offers as any[]) if (o.negotiation?.expected_savings_tnd > 0 && o.validation_status === 'validated' && !o.expired)
    ideas.push({ label: L3(l, `Négocier ${o.grade} ${o.supplier_name} de ${f0(o.price, 2)} vers ${f0(o.negotiation.target_price, 2)} ${o.currency}/t`, `Negotiate ${o.grade} ${o.supplier_name} from ${f0(o.price, 2)} to ${f0(o.negotiation.target_price, 2)} ${o.currency}/t`, `التفاوض على ${o.grade} ${o.supplier_name} نحو ${f0(o.negotiation.target_price, 2)}`), tnd: o.negotiation.expected_savings_tnd, src: `offre #${o.id}`, quality: true });
  for (const [m, k] of Object.entries(energyKpis(periods)) as [string, any][]) if (k.gap_to_best_tnd > 0)
    ideas.push({ label: L3(l, `${m} : revenir au meilleur coût énergie/t enregistré (${f0(k.best.energy_cost_t, 1)} TND/t)`, `${m}: return to best recorded energy cost/t (${f0(k.best.energy_cost_t, 1)} TND/t)`, `${m}: العودة إلى أفضل تكلفة طاقة مسجلة`), tnd: k.gap_to_best_tnd, src: `périodes #${k.best.period_id}/#${k.latest.period_id}`, quality: true });
  for (const v of variance(periods)) for (const d of v.drivers.filter((x: any) => x.delta_t > 0 && !['vp', 'recovered', 'electricity', 'gas', 'steam'].includes(x.key)).slice(0, 2)) {
    const cur = periods.find((p) => p.id === v.current_period);
    ideas.push({ label: L3(l, `${v.machine} : ramener « ${d.label} » au niveau de la période précédente (${f0(d.previous_t, 1)} TND/t)`, `${v.machine}: bring "${d.label}" back to previous level (${f0(d.previous_t, 1)} TND/t)`, `${v.machine}: إعادة «${d.label}» إلى مستواها السابق`), tnd: d.delta_t * (cur?.saleable_t ?? 0), src: `période #${v.current_period}`, quality: true });
  }
  for (const [m, p] of Object.entries(latestByMachine(periods)) as [string, any][]) {
    if (p.result.reject_rate_pct > 0 && p.gross_t > 0) {
      const oneP = (p.gross_t * 0.01) * p.result.variable_cost_per_t;
      ideas.push({ label: L3(l, `${m} : réduire les rebuts d’1 point (actuellement ${f0(p.result.reject_rate_pct, 1)} %)`, `${m}: cut rejects by 1 point (now ${f0(p.result.reject_rate_pct, 1)}%)`, `${m}: خفض المرفوضات بنقطة واحدة`), tnd: oneP, src: `période #${p.id}`, quality: true });
    }
  }
  ideas.sort((a, b) => b.tnd - a.tnd);
  if (!ideas.length) return empty('savings', l, title, [tr('add_offers', l), tr('add_periods', l)], 'savings');
  let acc = 0; const plan: typeof ideas = [];
  for (const i of ideas) { if (target && acc >= target) break; plan.push(i); acc += i.tnd; }
  const reached = !target || acc >= target;
  return {
    intent: 'savings', title, module: 'savings', confidence: 0.7, tone: reached ? 'ok' : 'warn',
    verdict: target
      ? (reached ? L3(l, `Objectif atteignable : ${plan.length} action(s) totalisent ${f0(acc)} TND.`, `Target reachable: ${plan.length} action(s) total ${f0(acc)} TND.`, `الهدف قابل للتحقيق: ${plan.length} إجراء(ات) بمجموع ${f0(acc)} دينار.`)
        : L3(l, `Objectif partiellement couvert : ${f0(acc)} TND identifiés sur ${f0(target)} TND. Il manque ${f0(target - acc)} TND.`, `Partly covered: ${f0(acc)} of ${f0(target)} TND identified.`, `مغطى جزئيًا: ${f0(acc)} من ${f0(target)} دينار.`))
      : L3(l, `${ideas.length} gisement(s) chiffré(s), ${f0(ideas.reduce((a, i) => a + i.tnd, 0))} TND au total.`, `${ideas.length} quantified opportunities, ${f0(ideas.reduce((a, i) => a + i.tnd, 0))} TND in total.`, `${ideas.length} فرصة توفير بمجموع ${f0(ideas.reduce((a, i) => a + i.tnd, 0))} دينار.`),
    points: [...plan.map((i) => `${i.label} — ${f0(i.tnd)} TND`), L3(l, 'Toutes ces actions préservent la qualité : prix d’achat, énergie, pertes. Aucune substitution de fibre sans validation qualité.', 'All actions preserve quality: purchase prices, energy, losses. No fibre substitution without quality validation.', 'كل الإجراءات تحافظ على الجودة.')],
    table: { head: [L3(l, 'Action', 'Action', 'الإجراء'), 'TND', L3(l, 'Source', 'Source', 'المصدر')], rows: plan.map((i) => [i.label, f0(i.tnd), i.src]) },
    sources: plan.map((i) => i.src), missing: [L3(l, `Déjà réalisé cette année : ${f0(sav.totals.realized)} TND`, `Already realized: ${f0(sav.totals.realized)} TND`, `محقق: ${f0(sav.totals.realized)} دينار`)],
    savings_tnd: Math.round(acc),
  };
}

// ── 7. Buy pulp now or negotiate?
async function buyNow(env: Env, l: Lang, grade: string): Promise<Answer> {
  const [mk, f] = await Promise.all([marketSeries(env, grade, 365), fibreAnalysis(env, { grade })]);
  const title = L3(l, `Acheter la pâte ${grade} maintenant ou négocier ?`, `Buy ${grade} pulp now or negotiate?`, `شراء اللب ${grade} الآن أم التفاوض؟`);
  const t = mk.trends[grade];
  const offers = (f.offers as any[]).filter((o) => o.negotiation && o.validation_status === 'validated' && !o.expired);
  if (!t && !offers.length) return empty('buy_now', l, title, [tr('add_market', l), tr('add_offers', l)], 'virgin_pulp');
  const pts: string[] = [];
  let verdict: string, tone: Answer['tone'] = 'info';
  const ch = t?.change_pct ?? null, chP = t?.change_period_pct ?? null;
  if (t) pts.push(L3(l, `Marché ${grade} : ${f0(t.latest.price)} ${t.latest.currency}/t le ${t.latest.price_date} (${ch === null ? 'un seul point' : `${ch > 0 ? '+' : ''}${f0(ch, 1)} % vs précédent`}${chP !== null ? `, ${chP > 0 ? '+' : ''}${f0(chP, 1)} % sur la période` : ''})`, `${grade} market: ${f0(t.latest.price)} ${t.latest.currency}/t on ${t.latest.price_date}`, `سوق ${grade}: ${f0(t.latest.price)} ${t.latest.currency}/طن`));
  for (const o of offers) pts.push(L3(l, `${o.supplier_name} : ${f0(o.price, 2)} ${o.currency}/t${o.market_nominal_in_offer_ccy ? ` (marché ${f0(o.market_nominal_in_offer_ccy, 2)})` : ''} → cible ${f0(o.negotiation.target_price, 2)}`, `${o.supplier_name}: ${f0(o.price, 2)} ${o.currency}/t → target ${f0(o.negotiation.target_price, 2)}`, `${o.supplier_name}: ${f0(o.price, 2)} ← المستهدف ${f0(o.negotiation.target_price, 2)}`));
  const abovemarket = offers.filter((o) => o.market_nominal_in_offer_ccy && o.price > o.market_nominal_in_offer_ccy);
  if (ch !== null && ch <= -2) { verdict = L3(l, 'NÉGOCIER / ATTENDRE : le marché baisse. Achetez seulement le besoin immédiat et renégociez à la baisse.', 'NEGOTIATE / WAIT: the market is falling. Buy only immediate needs and renegotiate down.', 'تفاوض / انتظر: السوق في انخفاض.'); tone = 'warn'; }
  else if (ch !== null && ch >= 2) { verdict = L3(l, 'ACHETER : le marché monte. Sécurisez les volumes nécessaires au prix actuel.', 'BUY: the market is rising. Secure needed volumes at current prices.', 'اشترِ: السوق في ارتفاع.'); tone = 'ok'; }
  else if (abovemarket.length) { verdict = L3(l, `NÉGOCIER : ${abovemarket.length} offre(s) au-dessus du prix marché.`, `NEGOTIATE: ${abovemarket.length} offer(s) above market price.`, `تفاوض: عروض فوق سعر السوق.`); tone = 'warn'; }
  else { verdict = L3(l, 'Marché stable : acheter au besoin sur la meilleure offre à coût effectif.', 'Stable market: buy as needed from the best effective-cost offer.', 'سوق مستقر: اشترِ حسب الحاجة.'); tone = 'ok'; }
  return {
    intent: 'buy_now', title, verdict, tone, points: pts, module: 'virgin_pulp', confidence: t && t.points >= 3 ? 0.7 : 0.5,
    formula: L3(l, 'Règle : variation du dernier prix marché validé ≥ +2 % → acheter ; ≤ −2 % → négocier/attendre ; sinon comparer offres et marché', 'Rule: last validated market change ≥ +2% → buy; ≤ −2% → negotiate/wait; else compare offers vs market', 'القاعدة: تغير ≥ +2% ← اشترِ؛ ≤ −2% ← تفاوض'),
    sources: [...(t ? [`${t.latest.source} (${t.latest.price_date})`] : []), ...offers.map((o) => `offre #${o.id}`)],
    missing: !t || t.points < 3 ? [L3(l, 'Historique de prix court : ajoutez des prix marché passés pour une tendance fiable', 'Short price history: add past market prices', 'سجل أسعار قصير')] : [],
    savings_tnd: offers.reduce((a, o) => a + (o.negotiation.expected_savings_tnd ?? 0), 0) || null,
  };
}

export const INTENTS = ['max_price', 'best_supplier', 'cost_increase', 'price_change', 'pulp_drop', 'savings', 'buy_now'] as const;

export async function answer(env: Env, intent: string, p: Record<string, any>, lang: Lang): Promise<Answer> {
  const l: Lang = (['fr', 'en', 'ar'] as const).includes(lang) ? lang : 'fr';
  const grade = String(p.grade || '').toUpperCase().replace(/[^A-Z0-9_]/g, '');
  const machine = ['PM1', 'PM2'].includes(p.machine) ? p.machine : 'PM1';
  const pctv = Number(p.pct);
  switch (intent) {
    case 'max_price': return maxPrice(env, l, grade || 'SWL');
    case 'best_supplier': return bestSupplier(env, l);
    case 'cost_increase': return costIncrease(env, l, machine);
    case 'price_change': return priceChange(env, l, machine, Number.isFinite(pctv) && pctv !== 0 ? Math.max(-50, Math.min(50, pctv)) : -5);
    case 'pulp_drop': return pulpDrop(env, l, Number.isFinite(pctv) && pctv > 0 ? Math.min(60, pctv) : 8);
    case 'savings': return savingsIdeas(env, l, Number(p.target) > 0 ? Number(p.target) : null);
    case 'buy_now': return buyNow(env, l, grade || 'BEKP');
    default: throw new Error('Question inconnue');
  }
}
