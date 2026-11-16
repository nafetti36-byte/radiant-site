/** Pure metric definitions and KPI math (no DB) — unit-tested. */
export const METRICS = {
  revenue: { label: "Total sales (all channels)", unit: "money" },
  attributed_revenue: { label: "Marketing-attributed revenue", unit: "money" },
  gross_profit: { label: "Gross profit (sales − COGS)", unit: "money" },
  operating_expenses: { label: "Other operating expenses (non-marketing)", unit: "money" },
  ad_spend: { label: "Paid media spend", unit: "money" },
  other_marketing_cost: { label: "Other marketing cost (tools, agency, events)", unit: "money" },
  sessions: { label: "Website sessions", unit: "count" },
  conversions: { label: "Conversions (orders / completed inquiries)", unit: "count" },
  leads: { label: "New leads", unit: "count" },
  new_customers: { label: "New customers", unit: "count" },
} as const;
export type MetricKey = keyof typeof METRICS;

export type Totals = Partial<Record<MetricKey, number>> & { _sources: Record<string, string[]> };

/** Derived KPIs. Each returns null when inputs are missing — never a guessed value. */
export function deriveKpis(t: Totals) {
  const has = (k: MetricKey) => t[k] !== undefined;
  const mkt = (t.ad_spend ?? 0) + (t.other_marketing_cost ?? 0);
  const anySpend = has("ad_spend") || has("other_marketing_cost");
  return {
    marketingSpend: anySpend ? mkt : null,
    netOperatingProfit: has("gross_profit") ? (t.gross_profit ?? 0) - mkt - (t.operating_expenses ?? 0) : null,
    conversionRate: has("sessions") && has("conversions") && t.sessions! > 0 ? t.conversions! / t.sessions! : null,
    cac: anySpend && has("new_customers") && t.new_customers! > 0 ? mkt / t.new_customers! : null,
    roas: has("ad_spend") && has("attributed_revenue") && t.ad_spend! > 0 ? t.attributed_revenue! / t.ad_spend! : null,
  };
}
