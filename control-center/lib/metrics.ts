import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";

export { METRICS, deriveKpis, type MetricKey, type Totals } from "./metrics-math.ts";
import type { MetricKey, Totals } from "./metrics-math.ts";

export async function metricTotals(brandId: number, from: string, to: string): Promise<Totals> {
  const rows = await db
    .select({ metric: schema.metricEntries.metric, source: schema.metricEntries.source, total: sql<string>`sum(${schema.metricEntries.value})` })
    .from(schema.metricEntries)
    .where(and(eq(schema.metricEntries.brandId, brandId), gte(schema.metricEntries.date, from), lte(schema.metricEntries.date, to)))
    .groupBy(schema.metricEntries.metric, schema.metricEntries.source);
  const out: Totals = { _sources: {} };
  for (const r of rows) {
    const k = r.metric as MetricKey;
    out[k] = (out[k] ?? 0) + Number(r.total);
    (out._sources[k] ??= []).push(r.source);
  }
  return out;
}

export function isoDay(d: Date) { return d.toISOString().slice(0, 10); }
export function rangeLastDays(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  return { from: isoDay(from), to: isoDay(to) };
}

/** Replace a source's metrics for a date range (used by integration syncs, idempotent). */
export async function replaceSourceMetrics(brandId: number, source: string, from: string, to: string, rows: { date: string; metric: MetricKey; value: number }[]) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.metricEntries).where(and(
      eq(schema.metricEntries.brandId, brandId), eq(schema.metricEntries.source, source),
      gte(schema.metricEntries.date, from), lte(schema.metricEntries.date, to),
    ));
    if (rows.length) await tx.insert(schema.metricEntries).values(rows.map((r) => ({ brandId, source, date: r.date, metric: r.metric, value: String(r.value) })));
  });
}
