import type { Env } from '../env';

/** Business parameters. Every default is a neutral, editable assumption shown in the UI
 *  as "hypothèse" — none of them is a market price. */
export const DEFAULT_SETTINGS = {
  company_name: 'Azur Papier',
  base_currency: 'TND',
  // Reference virgin pulp grade used to cap each recovered grade
  vp_reference_SWL: 'BEKP',
  vp_reference_HWS: 'BEKP',
  vp_reference_SOP: 'BEKP',
  // Quality equivalence: 1 t usable recovered fibre is worth X% of 1 t usable virgin fibre
  quality_equivalence_SWL: '95',
  quality_equivalence_HWS: '90',
  quality_equivalence_SOP: '92',
  // Virgin pulp landed-cost defaults when a market price (not an offer) is the reference
  vp_default_freight_tnd_t: '0',
  vp_default_customs_pct: '0',
  vp_default_handling_tnd_t: '0',
  vp_default_moisture_pct: '10',
  vp_default_process_loss_pct: '1',
  // Finance
  cost_of_capital_pct: '10',
  inventory_days: '30',
  negotiation_margin_pct: '5',
  target_margin_pct: '12',
  annual_savings_target_tnd: '0',
  // Alerts
  alert_price_change_pct: '5',
  alert_cost_variance_pct: '5',
  // Email ingestion allowlist (comma separated domains)
  email_allowed_domains: '',
  fx_currencies: 'EUR,USD',
  fx_provider_url: 'https://open.er-api.com/v6/latest/{CUR}',
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export async function getSettings(env: Env): Promise<Record<SettingKey, string>> {
  const rows = await env.DB.prepare('SELECT key, value FROM h360_settings').all<{ key: string; value: string }>();
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows.results) if (!r.key.startsWith('secret_')) out[r.key] = r.value;
  return out as Record<SettingKey, string>;
}

export function num(s: Record<string, string>, k: string, fallback = 0): number {
  const n = Number(s[k]);
  return Number.isFinite(n) ? n : fallback;
}
