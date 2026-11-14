// Live calculations while typing + smart pre-fill. Uses public/js/engine.js, which is
// compiled from the server's own engine (src/engine), so previews equal saved results.
import { h, api, fmt, pct } from './core.js';
import { effectiveCost, recoveredCeiling, negotiationTarget, equivalentPrice, computePeriod, simulatePrice } from './engine.js';

const REC = ['SWL', 'HWS', 'SOP'];
let ctxCache = null, ctxAt = 0;
export async function calcContext(force) {
  if (!ctxCache || force || Date.now() - ctxAt > 60000) { ctxCache = await api('/api/defaults/context'); ctxAt = Date.now(); }
  return ctxCache;
}

const item = (label, value, kind = '') => h('div', { class: `lp-item ${kind}` }, h('span', {}, label), h('strong', {}, value));
const n0 = (v) => (v === null || v === undefined ? 0 : Number(v));

/** Tracks which inputs the user typed in, so pre-fill never overwrites them. */
function trackTouched(form) {
  const touched = new Set();
  form.addEventListener('input', (e) => { if (e.isTrusted && e.target.name) touched.add(e.target.name); });
  return touched;
}
function fillUntouched(form, touched, values) {
  let n = 0;
  for (const [k, v] of Object.entries(values || {})) {
    if (v === null || v === undefined || touched.has(k) || !form.inputs[k]) continue;
    form.setValue(k, v, { silent: true }); n++;
  }
  return n;
}

// ───────── Offers ─────────
export function offerInput(o, fx) {
  return {
    price: n0(o.price), currency: o.currency || 'TND', fx_tnd: fx,
    freight_tnd_t: n0(o.freight_tnd_t), customs_pct: n0(o.customs_pct), handling_tnd_t: n0(o.handling_tnd_t), processing_tnd_t: n0(o.processing_tnd_t),
    energy_extra_tnd_t: n0(o.energy_extra_tnd_t), chemicals_extra_tnd_t: n0(o.chemicals_extra_tnd_t), other_tnd_t: n0(o.other_tnd_t),
    moisture_pct: o.moisture_pct ?? 10, contamination_pct: n0(o.contamination_pct), process_loss_pct: n0(o.process_loss_pct), payment_terms_days: o.payment_terms_days ?? null,
  };
}

/** Pure computation shared by the offer form and the calculator. */
export function analyseOffer(o, ctx) {
  const out = { warnings: [] };
  const grade = o.grade, cur = o.currency || 'TND';
  const fx = ctx.fx[cur];
  if (!fx) { out.warnings.push(`Taux ${cur}/TND manquant : saisissez-le dans Administration → Taux de change.`); return out; }
  if (!(o.price > 0)) return out;
  const input = offerInput(o, fx);
  try { out.cost = effectiveCost(input, ctx.fin); } catch (e) { out.warnings.push(e.message); return out; }
  const isRec = REC.includes(grade) || o.category === 'recovered';
  const best = ctx.best_by_grade?.[grade];
  const compEq = best && best.offer_id !== o.id ? equivalentPrice(input, ctx.fin, best.effective_tnd) : null;
  if (isRec) {
    const refG = ctx.vp_reference[grade] || 'BEKP';
    const ref = ctx.references[refG];
    if (!ref) { out.warnings.push(`Pas de référence pâte vierge ${refG} : ajoutez un prix marché ${refG} (Pâte vierge → Ajouter) pour calculer le plafond.`); return out; }
    out.ref = { grade: refG, ...ref };
    out.ceiling = recoveredCeiling(input, ctx.fin, ref.effective_tnd, ctx.quality_equivalence[grade] ?? 90, ref.nominal_tnd_t, !!o.ceiling_exception);
    out.nego = negotiationTarget(input.price, out.ceiling.ceiling, ctx.negotiation_margin_pct, compEq, fx, o.quantity_t || null);
  } else {
    const ref = ctx.references[grade];
    const cap = [compEq, ref ? ref.nominal_tnd_t / fx : null].filter((x) => x && x > 0);
    out.ref = ref ? { grade, ...ref } : null;
    out.nego = negotiationTarget(input.price, Math.min(input.price, ...cap), ctx.negotiation_margin_pct, compEq, fx, o.quantity_t || null);
  }
  out.isRec = isRec; out.fx = fx; out.best = best;
  return out;
}

export function renderOfferPreview(box, o, ctx, extra = {}) {
  const a = analyseOffer(o, ctx);
  const cur = o.currency || 'TND';
  if (!a.cost) { box.replaceChildren(...(a.warnings.length ? [h('div', { class: 'lp-head' }, 'Calcul automatique'), ...a.warnings.map((w) => h('div', { class: 'lp-verdict warn' }, w))] : [h('div', { class: 'lp-note' }, 'Saisissez le prix : le coût effectif, le plafond et le prix cible se calculent automatiquement.')])); return a; }
  const items = [
    item('Prix en TND/t', fmt(a.cost.nominal_tnd_t, 0)),
    item('Rendement fibre utile', pct(a.cost.usable_yield * 100, 1)),
    item('Coût effectif TND/t utile', fmt(a.cost.effective_tnd_per_usable_t, 0), 'info'),
  ];
  let verdict;
  if (a.nego) {
    const above = a.isRec ? a.nego.above_ceiling : a.nego.expected_savings_tnd_t > 0.5;
    items.push(item(a.isRec ? 'Prix maximum' : 'Prix plafond', `${fmt(a.nego.max_price, 2)} ${cur}`, a.isRec ? (above ? 'bad' : 'ok') : ''));
    items.push(item('Prix cible', `${fmt(a.nego.target_price, 2)} ${cur}`));
    items.push(item('Économie / t', `${fmt(a.nego.expected_savings_tnd_t, 0)} TND`, a.nego.expected_savings_tnd_t > 0 ? 'ok' : ''));
    if (a.nego.expected_savings_tnd) items.push(item('Économie totale', `${fmt(a.nego.expected_savings_tnd, 0)} TND`, 'ok'));
    if (a.isRec) verdict = above
      ? h('div', { class: 'lp-verdict bad' }, `Au-dessus du plafond de ${fmt(o.price - a.nego.max_price, 2)} ${cur}/t → négocier vers ${fmt(a.nego.target_price, 2)} ${cur}/t`)
      : a.nego.expected_savings_tnd_t > 0.5 ? h('div', { class: 'lp-verdict info' }, `Acceptable (sous le plafond). Marge de négociation : viser ${fmt(a.nego.target_price, 2)} ${cur}/t`) : h('div', { class: 'lp-verdict ok' }, 'Prix compétitif : au niveau de la cible');
    else verdict = a.nego.expected_savings_tnd_t > 0.5 ? h('div', { class: 'lp-verdict info' }, `Une offre ou le marché fait mieux : viser ${fmt(a.nego.target_price, 2)} ${cur}/t`) : h('div', { class: 'lp-verdict ok' }, a.best ? 'Meilleure offre de ce grade' : 'Première offre de ce grade');
  }
  const prev = extra.previous;
  const prevNote = prev && prev.currency === cur && prev.price ? h('div', { class: 'lp-note' }, `Offre précédente de ce fournisseur : ${fmt(prev.price, 2)} ${cur} (${prev.date}) → ${o.price >= prev.price ? '+' : ''}${pct(((o.price - prev.price) / prev.price) * 100, 1)}`) : null;
  box.replaceChildren(
    h('div', { class: 'lp-head' }, h('span', {}, '⚡ Calcul automatique'), cur !== 'TND' ? h('small', { class: 'muted' }, `1 ${cur} = ${a.fx} TND`) : null),
    verdict || null, h('div', { class: 'lp-grid' }, items), prevNote,
    a.ref ? h('div', { class: 'lp-note' }, `Référence : ${a.ref.grade} ${fmt(a.ref.effective_tnd, 0)} TND/t utile — ${a.ref.source}`) : null,
    a.isRec ? h('div', { class: 'lp-note' }, 'Aucune substitution sans validation qualité.') : null,
    ...a.warnings.map((w) => h('div', { class: 'lp-verdict warn' }, w)));
  return a;
}

export async function attachOfferLive(form, box, { id } = {}) {
  const ctx = await calcContext(true).catch(() => null);
  if (!ctx) return () => {};
  const touched = trackTouched(form);
  if (id) ['supplier_id', 'grade', 'currency', 'price'].forEach((k) => touched.add(k));
  let lastKey = '', previous = null, basisNote = '';
  return async (d) => {
    // grade → category automatically
    if (d.grade && form.inputs.category) {
      const cat = REC.includes(d.grade) ? 'recovered' : 'virgin_pulp';
      if (d.category !== cat) { form.setValue('category', cat, { silent: true }); d.category = cat; }
    }
    const key = `${d.supplier_id}|${d.grade}`;
    if (!id && key !== lastKey && (d.supplier_id || d.grade)) {
      lastKey = key;
      const def = await api(`/api/defaults/offer?supplier_id=${d.supplier_id || ''}&grade=${d.grade || ''}`).catch(() => null);
      if (def) {
        const n = fillUntouched(form, touched, def.values);
        previous = def.previous_price;
        basisNote = n ? `${n} champ(s) pré-rempli(s) depuis la ${def.basis} — vérifiez puis saisissez le prix.` : '';
        d = form.getData();
      }
    }
    const a = renderOfferPreview(box, { ...d, id }, ctx, { previous });
    if (basisNote) box.append(h('div', { class: 'lp-note' }, '✓ ', basisNote));
    return a;
  };
}

// ───────── Production periods ─────────
const PERIOD_KEYS = ['saleable_t', 'gross_t', 'rejects_t', 'downtime_h', 'available_h', 'vp_t', 'vp_cost_tnd', 'recovered_t', 'recovered_cost_tnd', 'electricity_kwh', 'electricity_tariff', 'gas_nm3', 'gas_tariff', 'steam_t', 'steam_cost_tnd_t', 'cogen_allocation_tnd', 'water_m3', 'water_tariff', 'chemicals_tnd', 'packaging_tnd', 'labour_tnd', 'maintenance_tnd', 'fixed_overhead_tnd', 'variable_overhead_tnd', 'freight_selling_tnd', 'closing_stock_t'];
export function periodInput(d) {
  const p = {};
  for (const k of PERIOD_KEYS) p[k] = n0(d[k]);
  p.available_h = d.available_h ? Number(d.available_h) : null;
  p.avg_selling_price_tnd_t = d.avg_selling_price_tnd_t ? Number(d.avg_selling_price_tnd_t) : null;
  return p;
}

export async function attachProductionLive(form, box, { id } = {}) {
  const ctx = await calcContext().catch(() => ({ target_margin_pct: 12 }));
  const touched = trackTouched(form);
  if (id) Object.keys(form.inputs).forEach((k) => touched.add(k));
  let lastMachine = '', basisNote = '';
  return async (d) => {
    if (!id && d.machine && d.machine !== lastMachine) {
      lastMachine = d.machine;
      const def = await api(`/api/defaults/production?machine=${d.machine}`).catch(() => null);
      if (def?.basis) {
        const n = fillUntouched(form, touched, { ...def.values, ...def.unit, ...def.fixed });
        basisNote = n ? `${n} champ(s) pré-rempli(s) depuis la ${def.basis} (tarifs, prix moyens, frais fixes) — vérifiez. Les consommations ne sont jamais estimées.` : '';
        d = form.getData();
      }
    }
    // total = tonnes × average price, when the user gives a price per tonne
    for (const [t, price, total] of [['vp_t', 'vp_price_tnd_t', 'vp_cost_tnd'], ['recovered_t', 'recovered_price_tnd_t', 'recovered_cost_tnd']]) {
      if (d[t] > 0 && d[price] > 0 && !touched.has(total)) {
        const v = Math.round(d[t] * d[price] * 100) / 100;
        if (d[total] !== v) { form.setValue(total, v, { silent: true }); d[total] = v; }
      }
    }
    if (d.gross_t > 0 && d.saleable_t > 0 && !touched.has('rejects_t') && d.gross_t >= d.saleable_t) {
      const v = Math.round((d.gross_t - d.saleable_t) * 1000) / 1000;
      if (d.rejects_t !== v) { form.setValue('rejects_t', v, { silent: true }); d.rejects_t = v; }
    }
    if (!(d.saleable_t > 0)) { box.replaceChildren(h('div', { class: 'lp-note' }, 'Saisissez le tonnage vendable : le coût par tonne, les marges et le prix cible se calculent automatiquement.'), basisNote ? h('div', { class: 'lp-note' }, '✓ ', basisNote) : null); return; }
    let r;
    try { r = computePeriod(periodInput(d), ctx.target_margin_pct ?? 12); } catch (e) { box.replaceChildren(h('div', { class: 'lp-verdict warn' }, e.message)); return; }
    const top = r.lines.filter((l) => l.tnd > 0).sort((a, b) => b.tnd - a.tnd).slice(0, 3).map((l) => `${l.label} ${fmt(l.tnd_t, 0)}`).join(' · ');
    const price = d.avg_selling_price_tnd_t;
    const kind = !price ? 'info' : price < r.variable_cost_per_t ? 'bad' : price < r.break_even_price_tnd_t ? 'bad' : price < r.target_price_tnd_t ? 'warn' : 'ok';
    const msg = !price ? `Prix de vente minimum (point mort) : ${fmt(r.break_even_price_tnd_t, 0)} TND/t — cible : ${fmt(r.target_price_tnd_t, 0)} TND/t`
      : kind === 'bad' ? `Prix de vente ${fmt(price, 0)} sous le point mort (${fmt(r.break_even_price_tnd_t, 0)} TND/t)`
      : kind === 'warn' ? `Rentable mais sous la cible de ${fmt(r.target_price_tnd_t - price, 0)} TND/t` : 'Marge cible atteinte';
    box.replaceChildren(
      h('div', { class: 'lp-head' }, h('span', {}, '⚡ Coût calculé automatiquement'), h('small', { class: 'muted' }, `${fmt(d.saleable_t, 0)} t vendables`)),
      h('div', { class: `lp-verdict ${kind}` }, msg),
      h('div', { class: 'lp-grid' },
        item('Coût / t vendable', `${fmt(r.cost_per_saleable_t, 0)} TND`, 'info'), item('Coût complet / t', `${fmt(r.full_cost_per_t, 0)} TND`),
        item('Fibre / Énergie', `${pct(r.fibre_pct, 0)} / ${pct(r.energy_pct, 0)}`), item('Coût total', `${fmt(r.manufacturing_tnd, 0)} TND`),
        item('kWh / t', fmt(r.kwh_per_t, 0)), item('Rebuts', pct(r.reject_rate_pct, 1)),
        item('Marge brute', price ? pct(r.gross_margin_pct, 1) : '—', price ? (r.gross_margin_pct < 0 ? 'bad' : 'ok') : ''), item('Prix cible', `${fmt(r.target_price_tnd_t, 0)} TND`)),
      top ? h('div', { class: 'lp-note' }, `Principaux postes (TND/t) : ${top}`) : null,
      basisNote ? h('div', { class: 'lp-note' }, '✓ ', basisNote) : null);
  };
}

export { simulatePrice };
