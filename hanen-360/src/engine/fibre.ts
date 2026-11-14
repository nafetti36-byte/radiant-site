/**
 * Smart raw-material pricing engine.
 *
 * Everything is expressed per tonne AS BOUGHT and converted to TND.
 *
 *   usable_yield = (1 − moisture) × (1 − contamination) × (1 − process_loss)
 *        → tonnes of bone-dry usable fibre obtained from 1 tonne bought
 *
 *   landed_TND/t = price × FX × (1 + customs%) + freight + handling
 *   attributable_TND/t = landed + processing + incremental energy + chemicals + other + financing
 *   financing_TND/t = price × FX × cost_of_capital × (inventory_days − payment_days) / 365
 *
 *   effective fibre cost (TND per usable tonne) = attributable / usable_yield
 *
 * Recovered-paper buying ceiling (nominal price in offer currency):
 *   the price P at which  effective(P) = VP_effective × quality_equivalence
 *   effective(P) is linear in P:  (P·FX·k + F) / Y  with  k = 1 + customs + financing_factor
 *   → P_max = (VP_eff × equiv × Y − F) / (FX × k)
 *
 * Business rule: the nominal recovered price must also not exceed the comparable
 * virgin-pulp nominal reference (converted to the same currency) unless a director
 * has explicitly authorised an exception on the offer.
 */

export interface OfferInput {
  price: number;
  currency: string;
  fx_tnd: number; // TND per 1 unit of currency
  freight_tnd_t: number;
  customs_pct: number;
  handling_tnd_t: number;
  processing_tnd_t: number;
  energy_extra_tnd_t: number;
  chemicals_extra_tnd_t: number;
  other_tnd_t: number;
  moisture_pct: number;
  contamination_pct: number;
  process_loss_pct: number;
  payment_terms_days: number | null;
}

export interface FinanceParams {
  cost_of_capital_pct: number;
  inventory_days: number;
}

export interface EffectiveCost {
  nominal_tnd_t: number;
  customs_tnd_t: number;
  landed_tnd_t: number;
  conversion_tnd_t: number;
  financing_tnd_t: number;
  attributable_tnd_t: number;
  usable_yield: number;
  effective_tnd_per_usable_t: number;
  breakdown: { label: string; tnd_t: number }[];
  formula: string;
}

const pct = (x: number) => (Number.isFinite(x) ? x : 0) / 100;

export function financingFactor(fin: FinanceParams, paymentDays: number | null): number {
  const days = fin.inventory_days - (paymentDays ?? 0);
  return pct(fin.cost_of_capital_pct) * days / 365;
}

export function usableYield(o: Pick<OfferInput, 'moisture_pct' | 'contamination_pct' | 'process_loss_pct'>): number {
  return (1 - pct(o.moisture_pct)) * (1 - pct(o.contamination_pct)) * (1 - pct(o.process_loss_pct));
}

/** Costs per tonne bought that do not depend on the nominal price. */
function fixedPerTonne(o: OfferInput): number {
  return o.freight_tnd_t + o.handling_tnd_t + o.processing_tnd_t + o.energy_extra_tnd_t + o.chemicals_extra_tnd_t + o.other_tnd_t;
}

export function effectiveCost(o: OfferInput, fin: FinanceParams): EffectiveCost {
  if (!(o.fx_tnd > 0)) throw new Error(`Taux de change manquant pour ${o.currency}`);
  const y = usableYield(o);
  if (!(y > 0)) throw new Error('Rendement fibre utilisable nul : vérifier humidité / contaminants / pertes');
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
      { label: 'Prix nominal', tnd_t: nominal },
      { label: 'Douane', tnd_t: customs },
      { label: 'Fret', tnd_t: o.freight_tnd_t },
      { label: 'Manutention', tnd_t: o.handling_tnd_t },
      { label: 'Traitement / tri / désencrage', tnd_t: o.processing_tnd_t },
      { label: 'Énergie incrémentale', tnd_t: o.energy_extra_tnd_t },
      { label: 'Chimie', tnd_t: o.chemicals_extra_tnd_t },
      { label: 'Autres', tnd_t: o.other_tnd_t },
      { label: 'Coût financier stock/paiement', tnd_t: financing },
    ],
    formula: `(${nominal.toFixed(1)} + ${customs.toFixed(1)} + ${(o.freight_tnd_t + o.handling_tnd_t).toFixed(1)} + ${conversion.toFixed(1)} + ${financing.toFixed(1)}) / ${y.toFixed(4)} = ${(attributable / y).toFixed(1)} TND/t utile`,
  };
}

export interface CeilingResult {
  economic_ceiling: number;        // nominal price (offer currency) where effective cost = VP equivalent
  vp_nominal_cap: number | null;   // VP nominal reference converted to offer currency
  ceiling: number;                 // max price applied (min of both unless exception)
  ceiling_rule: 'economic' | 'vp_nominal_cap';
  exception_applied: boolean;
  target_effective_tnd: number;    // VP_eff × equivalence
  formula: string;
}

export function recoveredCeiling(
  o: OfferInput,
  fin: FinanceParams,
  vpEffectiveTnd: number,
  qualityEquivalencePct: number,
  vpNominalTnd: number | null,
  exception: boolean,
): CeilingResult {
  const y = usableYield(o);
  const k = 1 + pct(o.customs_pct) + financingFactor(fin, o.payment_terms_days);
  const F = fixedPerTonne(o);
  const target = vpEffectiveTnd * pct(qualityEquivalencePct);
  const economic = (target * y - F) / (o.fx_tnd * k);
  const cap = vpNominalTnd !== null ? vpNominalTnd / o.fx_tnd : null;
  let ceiling = economic;
  let rule: CeilingResult['ceiling_rule'] = 'economic';
  if (cap !== null && cap < economic && !exception) { ceiling = cap; rule = 'vp_nominal_cap'; }
  return {
    economic_ceiling: economic,
    vp_nominal_cap: cap,
    ceiling: Math.max(0, ceiling),
    ceiling_rule: rule,
    exception_applied: exception && cap !== null && cap < economic,
    target_effective_tnd: target,
    formula: `P_max = (${vpEffectiveTnd.toFixed(1)} × ${qualityEquivalencePct}% × ${y.toFixed(4)} − ${F.toFixed(1)}) / (${o.fx_tnd} × ${k.toFixed(4)}) = ${economic.toFixed(2)} ${o.currency}/t`,
  };
}

export interface NegotiationResult {
  offer_price: number;
  max_price: number;
  target_price: number;
  above_ceiling: boolean;
  expected_savings_tnd_t: number;
  expected_savings_tnd: number | null;
  rationale: string;
}

/**
 * Target = min(ceiling × (1 − negotiation margin), best competing offer of the same grade
 * expressed at equal effective cost in this offer's terms). Never above the offer itself.
 */
export function negotiationTarget(
  offerPrice: number,
  ceiling: number,
  negotiationMarginPct: number,
  bestCompetitorEquivalent: number | null,
  fx: number,
  quantityT: number | null,
): NegotiationResult {
  let target = ceiling * (1 - pct(negotiationMarginPct));
  let rationale = `plafond × (1 − ${negotiationMarginPct}% marge de négociation)`;
  if (bestCompetitorEquivalent !== null && bestCompetitorEquivalent > 0 && bestCompetitorEquivalent < target) {
    target = bestCompetitorEquivalent;
    rationale = 'aligné sur la meilleure offre concurrente à coût fibre effectif égal';
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
    rationale,
  };
}

/** Price this offer would need to match a competitor's effective cost (same grade). */
export function equivalentPrice(o: OfferInput, fin: FinanceParams, competitorEffectiveTnd: number): number {
  const y = usableYield(o);
  const k = 1 + pct(o.customs_pct) + financingFactor(fin, o.payment_terms_days);
  return (competitorEffectiveTnd * y - fixedPerTonne(o)) / (o.fx_tnd * k);
}
