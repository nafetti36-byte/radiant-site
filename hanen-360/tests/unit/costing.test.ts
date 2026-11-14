import { describe, it, expect } from 'vitest';
import { computePeriod, simulatePrice, type PeriodInput } from '../../src/engine/costing';

const p: PeriodInput = { saleable_t: 1000, gross_t: 1050, rejects_t: 50, downtime_h: 20, available_h: 720, vp_t: 400, vp_cost_tnd: 1_000_000, recovered_t: 700, recovered_cost_tnd: 600_000,
  electricity_kwh: 900_000, electricity_tariff: 0.3, gas_nm3: 200_000, gas_tariff: 0.5, steam_t: 2000, steam_cost_tnd_t: 40, cogen_allocation_tnd: -20_000, water_m3: 15_000, water_tariff: 1,
  chemicals_tnd: 120_000, packaging_tnd: 40_000, labour_tnd: 150_000, maintenance_tnd: 80_000, fixed_overhead_tnd: 70_000, variable_overhead_tnd: 25_000, freight_selling_tnd: 50_000, avg_selling_price_tnd_t: 3200, closing_stock_t: 100 };

describe('Jumbo Roll costing', () => {
  const r = computePeriod(p, 12);
  it('totals manufacturing cost line by line', () => {
    const energy = 270_000 + 100_000 + 80_000 - 20_000;
    expect(r.energy_tnd).toBe(energy);
    expect(r.fibre_tnd).toBe(1_600_000);
    expect(r.manufacturing_tnd).toBe(1_600_000 + energy + 15_000 + 120_000 + 40_000 + 25_000 + 150_000 + 80_000 + 70_000);
    expect(r.cost_per_saleable_t).toBeCloseTo(r.manufacturing_tnd / 1000, 9);
    expect(r.lines.reduce((a, l) => a + l.pct, 0)).toBeCloseTo(100, 6);
  });
  it('derives ratios, margins and prices', () => {
    expect(r.kwh_per_t).toBe(900);
    expect(r.reject_rate_pct).toBeCloseTo((50 / 1050) * 100, 9);
    expect(r.fibre_mix_recovered_pct).toBeCloseTo((700 / 1100) * 100, 9);
    expect(r.full_cost_per_t).toBeCloseTo((r.manufacturing_tnd + 50_000) / 1000, 9);
    expect(r.break_even_price_tnd_t).toBeCloseTo(r.full_cost_per_t, 9);
    expect(r.target_price_tnd_t).toBeCloseTo(r.full_cost_per_t / 0.88, 9);
    expect(r.gross_margin_tnd_t).toBeCloseTo(3200 - r.cost_per_saleable_t, 9);
    expect(r.variable_tnd + r.fixed_tnd).toBeCloseTo(r.total_with_selling_tnd, 6);
    expect(r.inventory_value_tnd).toBeCloseTo(100 * r.cost_per_saleable_t, 6);
  });
  it('rejects zero saleable tonnage', () => {
    expect(() => computePeriod({ ...p, saleable_t: 0 }, 12)).toThrow();
  });
  it('simulation without changes reproduces the base costs', () => {
    const s = simulatePrice({ base: r, saleable_t: 1000, fibre_price_change_pct: 0, energy_price_change_pct: 0, volume_change_pct: 0, chemicals_change_pct: 0, proposed_price_tnd_t: null, current_price_tnd_t: 3200, competitor_price_tnd_t: null, target_margin_pct: 12 });
    expect(s.full_cost_t).toBeCloseTo(r.full_cost_per_t, 6);
    expect(s.variable_cost_t).toBeCloseTo(r.variable_cost_per_t, 6);
  });
  it('a 5% price cut is evaluated against costs and an 8% fibre drop lowers the break-even', () => {
    const s = simulatePrice({ base: r, saleable_t: 1000, fibre_price_change_pct: -8, energy_price_change_pct: 0, volume_change_pct: 0, chemicals_change_pct: 0, proposed_price_tnd_t: 3200 * 0.95, current_price_tnd_t: 3200, competitor_price_tnd_t: null, target_margin_pct: 12 });
    expect(s.break_even_price_t).toBeCloseTo(r.full_cost_per_t - (1_600_000 * 0.08) / 1000, 6);
    expect(s.proposed_change_pct).toBeCloseTo(-5, 9);
    expect(s.profit_delta_tnd).toBeCloseTo(-160 * 1000, 6);
  });
  it('fixed costs do not scale with volume', () => {
    const s = simulatePrice({ base: r, saleable_t: 1000, fibre_price_change_pct: 0, energy_price_change_pct: 0, volume_change_pct: 10, chemicals_change_pct: 0, proposed_price_tnd_t: null, current_price_tnd_t: 3200, competitor_price_tnd_t: null, target_margin_pct: 12 });
    expect(s.variable_cost_t).toBeCloseTo(r.variable_cost_per_t, 6);
    expect(s.full_cost_t).toBeCloseTo(r.variable_cost_per_t + r.fixed_tnd / 1100, 6);
  });
});
