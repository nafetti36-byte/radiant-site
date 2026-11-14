/** Jumbo Roll costing engine — one production period of PM1 or PM2. */

export interface PeriodInput {
  saleable_t: number;
  gross_t: number;
  rejects_t: number;
  downtime_h: number;
  available_h: number | null;
  vp_t: number;
  vp_cost_tnd: number;
  recovered_t: number;
  recovered_cost_tnd: number;
  electricity_kwh: number;
  electricity_tariff: number;
  gas_nm3: number;
  gas_tariff: number;
  steam_t: number;
  steam_cost_tnd_t: number;
  cogen_allocation_tnd: number;
  water_m3: number;
  water_tariff: number;
  chemicals_tnd: number;
  packaging_tnd: number;
  labour_tnd: number;
  maintenance_tnd: number;
  fixed_overhead_tnd: number;
  variable_overhead_tnd: number;
  freight_selling_tnd: number;
  avg_selling_price_tnd_t: number | null;
  closing_stock_t: number;
}

export interface CostResult {
  lines: { key: string; label: string; tnd: number; tnd_t: number; pct: number; nature: 'variable' | 'fixed' }[];
  fibre_tnd: number;
  energy_tnd: number;
  manufacturing_tnd: number;
  variable_tnd: number;
  fixed_tnd: number;
  total_with_selling_tnd: number;
  cost_per_saleable_t: number;
  full_cost_per_t: number;
  variable_cost_per_t: number;
  fibre_pct: number;
  energy_pct: number;
  fibre_mix_recovered_pct: number | null;
  fibre_consumption_t_per_t: number | null;
  kwh_per_t: number;
  gas_nm3_per_t: number;
  steam_t_per_t: number;
  water_m3_per_t: number;
  reject_rate_pct: number | null;
  availability_pct: number | null;
  gross_margin_tnd_t: number | null;
  gross_margin_pct: number | null;
  contribution_margin_tnd_t: number | null;
  break_even_price_tnd_t: number;
  target_price_tnd_t: number;
  inventory_value_tnd: number;
  sensitivity: { driver: string; change_pct: number; delta_cost_t: number }[];
}

export function computePeriod(p: PeriodInput, targetMarginPct: number): CostResult {
  const t = p.saleable_t;
  if (!(t > 0)) throw new Error('Tonnage vendable doit être > 0');
  const electricity = p.electricity_kwh * p.electricity_tariff;
  const gas = p.gas_nm3 * p.gas_tariff;
  const steam = p.steam_t * p.steam_cost_tnd_t;
  const water = p.water_m3 * p.water_tariff;
  const raw: [string, string, number, 'variable' | 'fixed'][] = [
    ['vp', 'Pâte vierge', p.vp_cost_tnd, 'variable'],
    ['recovered', 'Fibres recyclées', p.recovered_cost_tnd, 'variable'],
    ['electricity', 'Électricité', electricity, 'variable'],
    ['gas', 'Gaz', gas, 'variable'],
    ['steam', 'Vapeur', steam, 'variable'],
    ['cogen', 'Allocation cogénération', p.cogen_allocation_tnd, 'variable'],
    ['water', 'Eau', water, 'variable'],
    ['chemicals', 'Chimie', p.chemicals_tnd, 'variable'],
    ['packaging', 'Emballage', p.packaging_tnd, 'variable'],
    ['variable_overhead', 'Frais variables', p.variable_overhead_tnd, 'variable'],
    ['labour', 'Main-d’œuvre', p.labour_tnd, 'fixed'],
    ['maintenance', 'Maintenance', p.maintenance_tnd, 'fixed'],
    ['fixed_overhead', 'Frais fixes', p.fixed_overhead_tnd, 'fixed'],
  ];
  const manufacturing = raw.reduce((s, r) => s + r[2], 0);
  const lines = raw.map(([key, label, tnd, nature]) => ({
    key, label, tnd, nature, tnd_t: tnd / t, pct: manufacturing ? (tnd / manufacturing) * 100 : 0,
  }));
  const fibre = p.vp_cost_tnd + p.recovered_cost_tnd;
  const energy = electricity + gas + steam + p.cogen_allocation_tnd;
  const variable = raw.filter((r) => r[3] === 'variable').reduce((s, r) => s + r[2], 0) + p.freight_selling_tnd;
  const fixed = manufacturing - (variable - p.freight_selling_tnd);
  const total = manufacturing + p.freight_selling_tnd;
  const costT = manufacturing / t;
  const fullT = total / t;
  const varT = variable / t;
  const price = p.avg_selling_price_tnd_t;
  const fibreT = p.vp_t + p.recovered_t;
  const m = targetMarginPct / 100;

  const sens = [
    { driver: 'Prix fibre +10%', change_pct: 10, delta_cost_t: (fibre * 0.1) / t },
    { driver: 'Prix énergie +10%', change_pct: 10, delta_cost_t: (energy * 0.1) / t },
    { driver: 'Tonnage vendable −5% (rendement)', change_pct: -5, delta_cost_t: manufacturing / (t * 0.95) - costT },
    { driver: 'Chimie +10%', change_pct: 10, delta_cost_t: (p.chemicals_tnd * 0.1) / t },
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
    fibre_pct: manufacturing ? (fibre / manufacturing) * 100 : 0,
    energy_pct: manufacturing ? (energy / manufacturing) * 100 : 0,
    fibre_mix_recovered_pct: fibreT > 0 ? (p.recovered_t / fibreT) * 100 : null,
    fibre_consumption_t_per_t: fibreT > 0 ? fibreT / t : null,
    kwh_per_t: p.electricity_kwh / t,
    gas_nm3_per_t: p.gas_nm3 / t,
    steam_t_per_t: p.steam_t / t,
    water_m3_per_t: p.water_m3 / t,
    reject_rate_pct: p.gross_t > 0 ? (p.rejects_t / p.gross_t) * 100 : null,
    availability_pct: p.available_h && p.available_h > 0 ? ((p.available_h - p.downtime_h) / p.available_h) * 100 : null,
    gross_margin_tnd_t: price ? price - costT : null,
    gross_margin_pct: price ? ((price - costT) / price) * 100 : null,
    contribution_margin_tnd_t: price ? price - varT : null,
    break_even_price_tnd_t: fullT,
    target_price_tnd_t: m < 1 ? fullT / (1 - m) : fullT,
    inventory_value_tnd: p.closing_stock_t * costT,
    sensitivity: sens,
  };
}

export interface PriceSimInput {
  base: CostResult;
  saleable_t: number;
  fibre_price_change_pct: number;
  energy_price_change_pct: number;
  volume_change_pct: number;
  chemicals_change_pct: number;
  proposed_price_tnd_t: number | null;
  current_price_tnd_t: number | null;
  competitor_price_tnd_t: number | null;
  target_margin_pct: number;
}

export function simulatePrice(i: PriceSimInput) {
  const b = i.base;
  const vol = i.saleable_t * (1 + i.volume_change_pct / 100);
  if (!(vol > 0)) throw new Error('Volume simulé invalide');
  const chemicals = b.lines.find((l) => l.key === 'chemicals')?.tnd ?? 0;
  const fibre = b.fibre_tnd * (1 + i.fibre_price_change_pct / 100) * (vol / i.saleable_t);
  const energy = b.energy_tnd * (1 + i.energy_price_change_pct / 100) * (vol / i.saleable_t);
  const chem = chemicals * (1 + i.chemicals_change_pct / 100) * (vol / i.saleable_t);
  const otherVariable = (b.variable_tnd - b.fibre_tnd - b.energy_tnd - chemicals) * (vol / i.saleable_t);
  const variable = fibre + energy + chem + otherVariable;
  const fixed = b.fixed_tnd; // fixed costs do not scale with volume
  const varT = variable / vol;
  const fullT = (variable + fixed) / vol;
  const m = i.target_margin_pct / 100;
  const price = i.proposed_price_tnd_t ?? i.current_price_tnd_t;
  const marginAt = (p: number | null) => (p ? { margin_tnd_t: p - fullT, margin_pct: ((p - fullT) / p) * 100, contribution_tnd_t: p - varT, profit_tnd: (p - fullT) * vol } : null);
  const curr = marginAt(i.current_price_tnd_t);
  const prop = marginAt(i.proposed_price_tnd_t);
  return {
    simulated_volume_t: vol,
    variable_cost_t: varT,
    full_cost_t: fullT,
    floor_price_short_term_t: varT,          // below this every tonne destroys cash
    break_even_price_t: fullT,
    target_price_t: m < 1 ? fullT / (1 - m) : fullT,
    at_current_price: curr,
    at_proposed_price: prop,
    at_competitor_price: marginAt(i.competitor_price_tnd_t),
    proposed_change_pct: i.proposed_price_tnd_t && i.current_price_tnd_t ? ((i.proposed_price_tnd_t - i.current_price_tnd_t) / i.current_price_tnd_t) * 100 : null,
    profit_delta_tnd: curr && prop ? prop.profit_tnd - curr.profit_tnd : null,
    verdict: !price ? 'Saisir un prix pour évaluer la marge'
      : price < varT ? 'REFUS : prix sous le coût variable — chaque tonne détruit de la trésorerie'
      : price < fullT ? 'RISQUE : couvre le variable mais pas les frais fixes'
      : price < fullT / (1 - m) ? 'ACCEPTABLE : rentable mais sous la marge cible'
      : 'OK : marge cible atteinte',
  };
}
