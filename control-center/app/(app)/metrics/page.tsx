import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { METRICS } from "@/lib/metrics.ts";
import { fmtDate } from "@/components/ui.tsx";
import { addMetric, deleteMetric } from "../actions.ts";

export default async function MetricsPage() {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const [rows, campaigns] = await Promise.all([
    db.select().from(schema.metricEntries).where(eq(schema.metricEntries.brandId, brand.id)).orderBy(desc(schema.metricEntries.date), desc(schema.metricEntries.id)).limit(300),
    db.select().from(schema.campaigns).where(eq(schema.campaigns.brandId, brand.id)),
  ]);
  return (
    <>
      <h1>{t.metrics}</h1>
      <p className="muted">The dashboard reads only from here. Integration syncs write rows tagged with their source; manual entries require a source note (invoice, bank statement, CRM export) and are audit-logged.</p>
      <div className="card">
        <h2>Record a verified figure</h2>
        <form action={addMetric}>
          <input type="hidden" name="brandId" value={brand.id} />
          <div className="grid g4">
            <label>Date<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label>Metric<select name="metric">{Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            <label>Value ({brand.currency} for money)<input name="value" type="number" step="0.01" required /></label>
            <label>Campaign (optional)<select name="campaignId"><option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          </div>
          <label>Source / evidence note<input name="note" required minLength={3} placeholder="e.g. LinkedIn invoice INV-1234; bank stmt 2026-11" /></label>
          <button className="primary">{t.save}</button>
        </form>
      </div>
      <div className="card">
        <table><thead><tr><th>Date</th><th>Metric</th><th>Value</th><th>Source</th><th>Note</th><th>Recorded</th><th /></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={7} className="muted">No data recorded.</td></tr> : rows.map((r) => (
            <tr key={r.id}><td>{r.date}</td><td>{r.metric}</td><td>{Number(r.value).toLocaleString()}</td><td>{r.source}</td><td className="small">{r.note ?? ""}</td><td className="small muted">{fmtDate(r.createdAt)}</td>
              <td>{r.source === "manual" && <form action={deleteMetric}><input type="hidden" name="id" value={r.id} /><button className="small">Delete</button></form>}</td></tr>
          ))}</tbody></table>
      </div>
    </>
  );
}
