// GENERATED from src/engine/{fibre,costing}.ts by scripts/build-engine.mjs — do not edit

// src/engine/fibre.ts
var pct = (x) => (Number.isFinite(x) ? x : 0) / 100;
function financingFactor(fin, paymentDays) {
  const days = fin.inventory_days - (paymentDays ?? 0);
  return pct(fin.cost_of_capital_pct) * days / 365;
}
function usableYield(o) {
  return (1 - pct(o.moisture_pct)) * (1 - pct(o.contamination_pct)) * (1 - pct(o.process_loss_pct));
}
function fixedPerTonne(o) {
  return o.freight_tnd_t + o.handling_tnd_t + o.processing_tnd_t + o.energy_extra_tnd_t + o.chemicals_extra_tnd_t + o.other_tnd_t;
}
function effectiveCost(o, fin) {
  if (!(o.fx_tnd > 0)) throw new Error(`Taux de change manquant pour ${o.currency}`);
  const y = usableYield(o);
  if (!(y > 0)) throw new Error("Rendement fibre utilisable nul : v\xE9rifier humidit\xE9 / contaminants / pertes");
  const nominal = o.price * o.fx_tnd;
  const customs = nominal * pct(o.customs_pct);
  const landed = nominal + customs + o.freight_tnd_t + o.handling_tnd_t;
  const conversion = o.processing_tnd_t + o.energy_extra_tnd_t + o.chemicals_extra_tnd_t + o.other_tnd_t;
  const financing = nominal * financingFactor(fin, o.payment_terms_days);
  const attributable = landed + conversion + financing;
  return {
    nominal_tnd_t: nominal,
    customs_tnd_t: customs,
    landed_tnd_t: landed,
    conversion_tnd_t: conversion,
    financing_tnd_t: financing,
    attributable_tnd_t: attributable,
    usable_yield: y,
    effective_tnd_per_usable_t: attributable / y,
    breakdown: [
      { label: "Prix nominal", tnd_t: nominal },
      { label: "Douane", tnd_t: customs },
      { label: "Fret", tnd_t: o.freight_tnd_t },
      { label: "Manutention", tnd_t: o.handling_tnd_t },
      { label: "Traitement / tri / d\xE9sencrage", tnd_t: o.processing_tnd_t },
      { label: "\xC9nergie incr\xE9mentale", tnd_t: o.energy_extra_tnd_t },
      { label: "Chimie", tnd_t: o.chemicals_extra_tnd_t },
      { label: "Autres", tnd_t: o.other_tnd_t },
      { label: "Co\xFBt financier stock/paiement", tnd_t: financing }
    ],
    formula: `(${nominal.toFixed(1)} + ${customs.toFixed(1)} + ${(o.freight_tnd_t + o.handling_tnd_t).toFixed(1)} + ${conversion.toFixed(1)} + ${financing.toFixed(1)}) / ${y.toFixed(4)} = ${(attributable / y).toFixed(1)} TND/t utile`
  };
}
function recoveredCeiling(o, fin, vpEffectiveTnd, qualityEquivalencePct, vpNominalTnd, exception) {
  const y = usableYield(o);
  const k = 1 + pct(o.customs_pct) + financingFactor(fin, o.payment_terms_days);
  const F = fixedPerTonne(o);
  const target = vpEffectiveTnd * pct(qualityEquivalencePct);
  const economic = (target * y - F) / (o.fx_tnd * k);
  const cap = vpNominalTnd !== null ? vpNominalTnd / o.fx_tnd : null;
  let ceiling = economic;
  let rule = "economic";
  if (cap !== null && cap < economic && !exception) {
    ceiling = cap;
    rule = "vp_nominal_cap";
  }
  return {
    economic_ceiling: economic,
    vp_nominal_cap: cap,
    ceiling: Math.max(0, ceiling),
    ceiling_rule: rule,
    exception_applied: exception && cap !== null && cap < economic,
    target_effective_tnd: target,
    formula: `P_max = (${vpEffectiveTnd.toFixed(1)} \xD7 ${qualityEquivalencePct}% \xD7 ${y.toFixed(4)} \u2212 ${F.toFixed(1)}) / (${o.fx_tnd} \xD7 ${k.toFixed(4)}) = ${economic.toFixed(2)} ${o.currency}/t`
  };
}
function negotiationTarget(offerPrice, ceiling, negotiationMarginPct, bestCompetitorEquivalent, fx, quantityT) {
  let target = ceiling * (1 - pct(negotiationMarginPct));
  let rationale = `plafond \xD7 (1 \u2212 ${negotiationMarginPct}% marge de n\xE9gociation)`;
  if (bestCompetitorEquivalent !== null && bestCompetitorEquivalent > 0 && bestCompetitorEquivalent < target) {
    target = bestCompetitorEquivalent;
    rationale = "align\xE9 sur la meilleure offre concurrente \xE0 co\xFBt fibre effectif \xE9gal";
  }
  target = Math.min(target, offerPrice);
  const savingsT = (offerPrice - target) * fx;
  return {
    offer_price: offerPrice,
    max_price: ceiling,
    target_price: Math.max(0, target),
    above_ceiling: offerPrice > ceiling,
    expected_savings_tnd_t: savingsT,
    expected_savings_tnd: quantityT ? savingsT * quantityT : null,
    rationale
  };
}
function equivalentPrice(o, fin, competitorEffectiveTnd) {
  const y = usableYield(o);
  const k = 1 + pct(o.customs_pct) + financingFactor(fin, o.payment_terms_days);
  return (competitorEffectiveTnd * y - fixedPerTonne(o)) / (o.fx_tnd * k);
}

// src/engine/costing.ts
function computePeriod(p, targetMarginPct) {
  const t = p.saleable_t;
  if (!(t > 0)) throw new Error("Tonnage vendable doit \xEAtre > 0");
  const electricity = p.electricity_kwh * p.electricity_tariff;
  const gas = p.gas_nm3 * p.gas_tariff;
  const steam = p.steam_t * p.steam_cost_tnd_t;
  const water = p.water_m3 * p.water_tariff;
  const raw = [
    ["vp", "P\xE2te vierge", p.vp_cost_tnd, "variable"],
    ["recovered", "Fibres recycl\xE9es", p.recovered_cost_tnd, "variable"],
    ["electricity", "\xC9lectricit\xE9", electricity, "variable"],
    ["gas", "Gaz", gas, "variable"],
    ["steam", "Vapeur", steam, "variable"],
    ["cogen", "Allocation cog\xE9n\xE9ration", p.cogen_allocation_tnd, "variable"],
    ["water", "Eau", water, "variable"],
    ["chemicals", "Chimie", p.chemicals_tnd, "variable"],
    ["packaging", "Emballage", p.packaging_tnd, "variable"],
    ["variable_overhead", "Frais variables", p.variable_overhead_tnd, "variable"],
    ["labour", "Main-d\u2019\u0153uvre", p.labour_tnd, "fixed"],
    ["maintenance", "Maintenance", p.maintenance_tnd, "fixed"],
    ["fixed_overhead", "Frais fixes", p.fixed_overhead_tnd, "fixed"]
  ];
  const manufacturing = raw.reduce((s, r) => s + r[2], 0);
  const lines = raw.map(([key, label, tnd, nature]) => ({
    key,
    label,
    tnd,
    nature,
    tnd_t: tnd / t,
    pct: manufacturing ? tnd / manufacturing * 100 : 0
  }));
  const fibre = p.vp_cost_tnd + p.recovered_cost_tnd;
  const energy = electricity + gas + steam + p.cogen_allocation_tnd;
  const variable = raw.filter((r) => r[3] === "variable").reduce((s, r) => s + r[2], 0) + p.freight_selling_tnd;
  const fixed = manufacturing - (variable - p.freight_selling_tnd);
  const total = manufacturing + p.freight_selling_tnd;
  const costT = manufacturing / t;
  const fullT = total / t;
  const varT = variable / t;
  const price = p.avg_selling_price_tnd_t;
  const fibreT = p.vp_t + p.recovered_t;
  const m = targetMarginPct / 100;
  const sens = [
    { driver: "Prix fibre +10%", change_pct: 10, delta_cost_t: fibre * 0.1 / t },
    { driver: "Prix \xE9nergie +10%", change_pct: 10, delta_cost_t: energy * 0.1 / t },
    { driver: "Tonnage vendable \u22125% (rendement)", change_pct: -5, delta_cost_t: manufacturing / (t * 0.95) - costT },
    { driver: "Chimie +10%", change_pct: 10, delta_cost_t: p.chemicals_tnd * 0.1 / t }
  ];
  return {
    lines,
    fibre_tnd: fibre,
    energy_tnd: energy,
    manufacturing_tnd: manufacturing,
    variable_tnd: variable,
    fixed_tnd: fixed,
    total_with_selling_tnd: total,
    cost_per_saleable_t: costT,
    full_cost_per_t: fullT,
    variable_cost_per_t: varT,
    fibre_pct: manufacturing ? fibre / manufacturing * 100 : 0,
    energy_pct: manufacturing ? energy / manufacturing * 100 : 0,
    fibre_mix_recovered_pct: fibreT > 0 ? p.recovered_t / fibreT * 100 : null,
    fibre_consumption_t_per_t: fibreT > 0 ? fibreT / t : null,
    kwh_per_t: p.electricity_kwh / t,
    gas_nm3_per_t: p.gas_nm3 / t,
    steam_t_per_t: p.steam_t / t,
    water_m3_per_t: p.water_m3 / t,
    reject_rate_pct: p.gross_t > 0 ? p.rejects_t / p.gross_t * 100 : null,
    availability_pct: p.available_h && p.available_h > 0 ? (p.available_h - p.downtime_h) / p.available_h * 100 : null,
    gross_margin_tnd_t: price ? price - costT : null,
    gross_margin_pct: price ? (price - costT) / price * 100 : null,
    contribution_margin_tnd_t: price ? price - varT : null,
    break_even_price_tnd_t: fullT,
    target_price_tnd_t: m < 1 ? fullT / (1 - m) : fullT,
    inventory_value_tnd: p.closing_stock_t * costT,
    sensitivity: sens
  };
}
function simulatePrice(i) {
  const b = i.base;
  const vol = i.saleable_t * (1 + i.volume_change_pct / 100);
  if (!(vol > 0)) throw new Error("Volume simul\xE9 invalide");
  const chemicals = b.lines.find((l) => l.key === "chemicals")?.tnd ?? 0;
  const fibre = b.fibre_tnd * (1 + i.fibre_price_change_pct / 100) * (vol / i.saleable_t);
  const energy = b.energy_tnd * (1 + i.energy_price_change_pct / 100) * (vol / i.saleable_t);
  const chem = chemicals * (1 + i.chemicals_change_pct / 100) * (vol / i.saleable_t);
  const otherVariable = (b.variable_tnd - b.fibre_tnd - b.energy_tnd - chemicals) * (vol / i.saleable_t);
  const variable = fibre + energy + chem + otherVariable;
  const fixed = b.fixed_tnd;
  const varT = variable / vol;
  const fullT = (variable + fixed) / vol;
  const m = i.target_margin_pct / 100;
  const price = i.proposed_price_tnd_t ?? i.current_price_tnd_t;
  const marginAt = (p) => p ? { margin_tnd_t: p - fullT, margin_pct: (p - fullT) / p * 100, contribution_tnd_t: p - varT, profit_tnd: (p - fullT) * vol } : null;
  const curr = marginAt(i.current_price_tnd_t);
  const prop = marginAt(i.proposed_price_tnd_t);
  return {
    simulated_volume_t: vol,
    variable_cost_t: varT,
    full_cost_t: fullT,
    floor_price_short_term_t: varT,
    // below this every tonne destroys cash
    break_even_price_t: fullT,
    target_price_t: m < 1 ? fullT / (1 - m) : fullT,
    at_current_price: curr,
    at_proposed_price: prop,
    at_competitor_price: marginAt(i.competitor_price_tnd_t),
    proposed_change_pct: i.proposed_price_tnd_t && i.current_price_tnd_t ? (i.proposed_price_tnd_t - i.current_price_tnd_t) / i.current_price_tnd_t * 100 : null,
    profit_delta_tnd: curr && prop ? prop.profit_tnd - curr.profit_tnd : null,
    verdict: !price ? "Saisir un prix pour \xE9valuer la marge" : price < varT ? "REFUS : prix sous le co\xFBt variable \u2014 chaque tonne d\xE9truit de la tr\xE9sorerie" : price < fullT ? "RISQUE : couvre le variable mais pas les frais fixes" : price < fullT / (1 - m) ? "ACCEPTABLE : rentable mais sous la marge cible" : "OK : marge cible atteinte"
  };
}
export {
  computePeriod,
  effectiveCost,
  equivalentPrice,
  negotiationTarget,
  recoveredCeiling,
  simulatePrice,
  usableYield
};
