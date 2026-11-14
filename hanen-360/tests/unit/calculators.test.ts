import { describe, it, expect } from 'vitest';
// @ts-ignore — plain ESM module shipped to the browser
import { CALCULATORS, contextValue } from '../../public/js/calc-defs.js';
import { effectiveCost } from '../../src/engine/fibre';

const calc = (id: string) => CALCULATORS.find((c: any) => c.id === id);
const val = (res: any[], fr: string) => res.find((r) => (r.label.fr ?? r.label) === fr)?.value;
const ctx = { fin: { cost_of_capital_pct: 10, inventory_days: 30 }, negotiation_margin_pct: 5 };

describe('calculator library', () => {
  it('has 17 calculators, each with icon, formula, inputs and FR/EN/AR titles', () => {
    expect(CALCULATORS.length).toBe(17);
    for (const c of CALCULATORS) {
      expect(c.icon && c.formula && c.inputs.length && c.title.fr && c.title.en && c.title.ar).toBeTruthy();
      expect(c.compute({}, ctx)).toBeNull(); // nothing entered → no fake result
    }
  });
  it('currency conversion', () => { expect(val(calc('fx').compute({ amount: 100, rate: 3.4 }), 'Montant en TND')).toBeCloseTo(340); });
  it('landed cost', () => {
    const r = calc('landed').compute({ price: 700, rate: 3.1, insurance_pct: 0.5, customs_pct: 2, freight: 60, handling: 20 });
    expect(val(r, 'Coût rendu usine')).toBeCloseTo(2170 + 10.85 + 43.4 + 60 + 20, 6);
  });
  it('dry weight and moisture claim', () => {
    const r = calc('dry').compute({ weight: 100, moisture: 14, std: 10, price: 1000 });
    expect(val(r, 'Fibre sèche')).toBeCloseTo(86);
    expect(val(r, 'Poids facturable (base contractuelle)')).toBeCloseTo(86 / 0.9, 6);
    expect(val(r, 'Montant à réclamer')).toBeCloseTo((100 - 86 / 0.9) * 1000, 6);
  });
  it('effective fibre cost equals the engine', () => {
    const r = calc('effective').compute({ price: 900, freight: 30, processing: 80, energy: 20, chemicals: 25, moisture: 10, contamination: 3, loss: 15, payment_days: 60 }, ctx);
    const e = effectiveCost({ price: 900, currency: 'TND', fx_tnd: 1, freight_tnd_t: 30, customs_pct: 0, handling_tnd_t: 0, processing_tnd_t: 80, energy_extra_tnd_t: 20, chemicals_extra_tnd_t: 25, other_tnd_t: 0, moisture_pct: 10, contamination_pct: 3, process_loss_pct: 15, payment_terms_days: 60 }, ctx.fin);
    expect(val(r, 'Coût effectif / t fibre utile')).toBeCloseTo(e.effective_tnd_per_usable_t, 9);
  });
  it('recovered ceiling with verdict and savings', () => {
    const r = calc('ceiling').compute({ vp_eff: 2462.77, vp_nominal: 2170, equiv: 95, price: 1700, freight: 30, processing: 80, energy: 20, chemicals: 25, moisture: 10, contamination: 3, loss: 15, quantity: 500 }, ctx);
    const max = val(r, 'Prix maximum');
    expect(max).toBeGreaterThan(1500); expect(max).toBeLessThan(1700);
    expect(val(r, 'Verdict').fr).toMatch(/Trop cher/);
    expect(val(r, 'Économie attendue')).toBeGreaterThan(0);
  });
  it('machine output from speed, width, grammage', () => {
    const r = calc('pm_output').compute({ speed: 1500, width: 2.7, gsm: 17, eff: 90, hours: 24 });
    expect(val(r, 'Production théorique')).toBeCloseTo(4.131, 6);
    expect(val(r, 'Production nette / jour')).toBeCloseTo(4.131 * 24 * 0.9, 6);
  });
  it('availability and rejects', () => {
    const r = calc('oee').compute({ available: 720, downtime: 36, gross: 1050, saleable: 1000, fibre: 1100 });
    expect(val(r, 'Disponibilité')).toBeCloseTo(95);
    expect(val(r, 'Rebuts / casses')).toBeCloseTo((50 / 1050) * 100, 6);
    expect(val(r, 'Rendement matière')).toBeCloseTo((1000 / 1100) * 100, 6);
  });
  it('cost of rejects', () => {
    const r = calc('reject_cost').compute({ gross: 1050, reject_pct: 5, var_cost: 1500 });
    expect(val(r, 'Coût des rebuts')).toBeCloseTo(78750); expect(val(r, 'Gain si −1 point')).toBeCloseTo(15750);
  });
  it('energy cost per tonne', () => {
    const r = calc('energy_t').compute({ saleable: 1000, kwh: 900000, kwh_price: 0.3, gas: 200000, gas_price: 0.5, steam: 2000, steam_price: 40, water: 0, water_price: 0 });
    expect(val(r, 'Coût énergie / t')).toBeCloseTo(450);
  });
  it('energy saving and payback', () => {
    const r = calc('energy_saving').compute({ now: 900, target: 850, tariff: 0.3, tonnes: 12000, invest: 360000 });
    expect(val(r, 'Gain annuel')).toBeCloseTo(180000); expect(val(r, 'Retour sur investissement')).toBeCloseTo(24);
  });
  it('selling price floor / break-even / target', () => {
    const r = calc('price').compute({ var: 1500, full: 2300, margin: 12, price: 2500 });
    expect(val(r, 'Prix cible')).toBeCloseTo(2300 / 0.88, 6); expect(val(r, 'Marge brute')).toBeCloseTo(8);
  });
  it('volume needed after a price cut', () => {
    const r = calc('volume').compute({ price: 3000, cut: 5, var: 1800, volume: 1000 });
    expect(val(r, 'Volume nécessaire')).toBeCloseTo(1000 * 1200 / 1050, 6);
    expect(calc('volume').compute({ price: 1000, cut: 50, var: 900, volume: 10 })[0].tone).toBe('bad');
  });
  it('stock financing, negotiation gain, savings target, fibre mix, quick cost', () => {
    expect(val(calc('stock').compute({ value: 1e6, rate: 10, days: 60, pay_days: 30 }), 'Coût financier')).toBeCloseTo(1e6 * 0.1 * 30 / 365, 6);
    expect(val(calc('nego').compute({ old: 300, new: 280, qty: 500, rate: 3.4 }), 'Gain total')).toBeCloseTo(34000);
    expect(val(calc('savings_target').compute({ target: 100000, tonnes: 12000, cost: 2500 }), 'Économie à trouver / t')).toBeCloseTo(100000 / 12000, 9);
    const mix = calc('mix').compute({ vp_t: 400, vp_price: 2500, rec_t: 700, rec_price: 857.142857, saleable: 1000 });
    expect(val(mix, 'Coût fibre / t vendable')).toBeCloseTo(1600, 3); expect(val(mix, 'Part recyclé')).toBeCloseTo(700 / 11, 6);
    const q = calc('quick_cost').compute({ saleable_t: 1000, vp_cost_tnd: 1000000, recovered_cost_tnd: 600000, energy_tnd: 450000, chemicals_tnd: 120000, labour_tnd: 150000, margin: 12, price: 3200 });
    expect(val(q, 'Coût / t vendable')).toBeCloseTo(2320); expect(val(q, 'Prix cible')).toBeCloseTo(2320 / 0.88, 6);
  });
  it('pre-fills from company data', () => {
    const c = { fx: { EUR: 3.38, USD: 3.11 }, vp_reference: { SWL: 'BEKP' }, references: { BEKP: { effective_tnd: 2462.7712, nominal_tnd_t: 2170 } }, target_margin_pct: 12, fin: { cost_of_capital_pct: 9 }, last: { electricity_tariff: 0.31 } };
    expect(contextValue('fx_eur', c)).toBe(3.38); expect(contextValue('vp_ref', c)).toBe(2462.77); expect(contextValue('last_elec', c)).toBe(0.31); expect(contextValue('coc', c)).toBe(9);
  });
});
