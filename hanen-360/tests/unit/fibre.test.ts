import { describe, it, expect } from 'vitest';
import { effectiveCost, recoveredCeiling, negotiationTarget, usableYield, equivalentPrice, type OfferInput } from '../../src/engine/fibre';

const fin = { cost_of_capital_pct: 10, inventory_days: 30 };
const swl: OfferInput = { price: 900, currency: 'TND', fx_tnd: 1, freight_tnd_t: 30, customs_pct: 0, handling_tnd_t: 0, processing_tnd_t: 80, energy_extra_tnd_t: 20, chemicals_extra_tnd_t: 25, other_tnd_t: 0, moisture_pct: 10, contamination_pct: 3, process_loss_pct: 15, payment_terms_days: 60 };
const bekp: OfferInput = { price: 700, currency: 'USD', fx_tnd: 3.1, freight_tnd_t: 60, customs_pct: 0, handling_tnd_t: 0, processing_tnd_t: 0, energy_extra_tnd_t: 0, chemicals_extra_tnd_t: 0, other_tnd_t: 0, moisture_pct: 10, contamination_pct: 0, process_loss_pct: 1, payment_terms_days: 90 };

describe('effective fibre cost', () => {
  it('computes usable yield multiplicatively', () => {
    expect(usableYield(swl)).toBeCloseTo(0.9 * 0.97 * 0.85, 10);
  });
  it('matches the hand calculation for an SWL offer', () => {
    const c = effectiveCost(swl, fin);
    const financing = 900 * 0.1 * (30 - 60) / 365;
    expect(c.financing_tnd_t).toBeCloseTo(financing, 6);
    expect(c.landed_tnd_t).toBeCloseTo(930, 6);
    expect(c.attributable_tnd_t).toBeCloseTo(930 + 125 + financing, 6);
    expect(c.effective_tnd_per_usable_t).toBeCloseTo((930 + 125 + financing) / (0.9 * 0.97 * 0.85), 6);
    expect(c.effective_tnd_per_usable_t).toBeCloseTo(1411.77, 1);
  });
  it('converts currency and customs for virgin pulp', () => {
    const c = effectiveCost({ ...bekp, customs_pct: 2 }, fin);
    expect(c.nominal_tnd_t).toBeCloseTo(2170, 6);
    expect(c.customs_tnd_t).toBeCloseTo(43.4, 6);
  });
  it('rejects missing FX and zero yield', () => {
    expect(() => effectiveCost({ ...swl, fx_tnd: 0 }, fin)).toThrow(/change/);
    expect(() => effectiveCost({ ...swl, process_loss_pct: 100 }, fin)).toThrow(/Rendement/);
  });
  it('never compares nominal prices: a cheaper nominal offer can be more expensive per usable tonne', () => {
    const dirty = { ...swl, price: 850, contamination_pct: 15, process_loss_pct: 25 };
    expect(dirty.price).toBeLessThan(swl.price);
    expect(effectiveCost(dirty, fin).effective_tnd_per_usable_t).toBeGreaterThan(effectiveCost(swl, fin).effective_tnd_per_usable_t);
  });
});

describe('recovered paper ceiling', () => {
  const vp = effectiveCost(bekp, fin);
  it('economic ceiling gives effective cost equal to VP effective × equivalence', () => {
    const c = recoveredCeiling(swl, fin, vp.effective_tnd_per_usable_t, 95, vp.nominal_tnd_t, false);
    const atCeiling = effectiveCost({ ...swl, price: c.economic_ceiling }, fin);
    expect(atCeiling.effective_tnd_per_usable_t).toBeCloseTo(vp.effective_tnd_per_usable_t * 0.95, 6);
    expect(c.ceiling_rule).toBe('economic');
    expect(c.ceiling).toBeCloseTo(1594.2, 0);
  });
  it('caps at the virgin pulp nominal price unless a director exception exists', () => {
    // very clean recovered fibre → economic ceiling above VP nominal → business rule applies
    const clean = { ...swl, contamination_pct: 0, process_loss_pct: 0, processing_tnd_t: 0, energy_extra_tnd_t: 0, chemicals_extra_tnd_t: 0, freight_tnd_t: 0 };
    const capped = recoveredCeiling(clean, fin, vp.effective_tnd_per_usable_t, 100, vp.nominal_tnd_t, false);
    expect(capped.economic_ceiling).toBeGreaterThan(vp.nominal_tnd_t);
    expect(capped.ceiling_rule).toBe('vp_nominal_cap');
    expect(capped.ceiling).toBeCloseTo(vp.nominal_tnd_t, 6);
    const exc = recoveredCeiling(clean, fin, vp.effective_tnd_per_usable_t, 100, vp.nominal_tnd_t, true);
    expect(exc.ceiling).toBeCloseTo(exc.economic_ceiling, 6);
    expect(exc.exception_applied).toBe(true);
  });
  it('handles offers in a foreign currency', () => {
    const eur = { ...swl, currency: 'EUR', fx_tnd: 3.4, price: 280 };
    const c = recoveredCeiling(eur, fin, vp.effective_tnd_per_usable_t, 95, vp.nominal_tnd_t, false);
    const at = effectiveCost({ ...eur, price: c.economic_ceiling }, fin);
    expect(at.effective_tnd_per_usable_t).toBeCloseTo(vp.effective_tnd_per_usable_t * 0.95, 6);
    expect(c.vp_nominal_cap).toBeCloseTo(2170 / 3.4, 6);
  });
});

describe('negotiation target', () => {
  it('targets ceiling minus margin, never above the offer', () => {
    const n = negotiationTarget(1700, 1600, 5, null, 1, 500);
    expect(n.above_ceiling).toBe(true);
    expect(n.target_price).toBeCloseTo(1520, 6);
    expect(n.expected_savings_tnd_t).toBeCloseTo(180, 6);
    expect(n.expected_savings_tnd).toBeCloseTo(90000, 6);
    expect(negotiationTarget(900, 1600, 5, null, 1, 100).expected_savings_tnd_t).toBe(0);
  });
  it('aligns on a cheaper competitor at equal effective cost', () => {
    const competitorEff = effectiveCost({ ...swl, price: 850 }, fin).effective_tnd_per_usable_t;
    const eq = equivalentPrice(swl, fin, competitorEff);
    expect(eq).toBeCloseTo(850, 6);
    const n = negotiationTarget(900, 1600, 5, eq, 1, 1000);
    expect(n.target_price).toBeCloseTo(850, 6);
    expect(n.expected_savings_tnd).toBeCloseTo(50000, 6);
  });
});
