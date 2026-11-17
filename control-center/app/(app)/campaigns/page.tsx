import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { Badge, fmtMoney } from "@/components/ui.tsx";
import { createCampaign } from "../actions.ts";

import { CHANNELS } from "@/lib/constants.ts";

export default async function CampaignsPage() {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const rows = await db.select().from(schema.campaigns).where(eq(schema.campaigns.brandId, brand.id)).orderBy(desc(schema.campaigns.updatedAt));
  return (
    <>
      <h1>{t.campaigns}</h1>
      <p className="muted">Lifecycle: draft → pending approval → approved / rejected → live → paused / completed. Nothing goes live without your recorded approval. The system does not push campaigns to ad platforms in this version; “live” is recorded by you after launching.</p>
      <div className="card">
        <table><thead><tr><th>Campaign</th><th>Channel</th><th>Market</th><th>Budget</th><th>Dates</th><th>{t.status}</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={6} className="muted">No campaigns yet.</td></tr> : rows.map((c) => (
            <tr key={c.id}><td><Link href={`/campaigns/${c.id}`}>{c.name}</Link></td><td>{c.channel}</td><td>{c.market ?? "—"}</td>
              <td>{fmtMoney(Number(c.budget), c.currency)}</td><td className="small">{c.startDate ?? "?"} → {c.endDate ?? "?"}</td><td><Badge s={c.status} /></td></tr>
          ))}</tbody></table>
      </div>
      <div className="card">
        <h2>Plan a new campaign (draft)</h2>
        <form action={createCampaign}>
          <input type="hidden" name="brandId" value={brand.id} />
          <div className="grid g3">
            <label>Name<input name="name" required /></label>
            <label>Channel<select name="channel">{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Market<input name="market" placeholder="e.g. Saudi Arabia" /></label>
            <label>Language<select name="language"><option>en</option><option>ar</option><option>fr</option></select></label>
            <label>Budget<input name="budget" type="number" min="0" step="1" defaultValue="0" /></label>
            <label>Currency<input name="currency" defaultValue={brand.currency} pattern="[A-Z]{3}" /></label>
            <label>Start<input name="startDate" type="date" /></label>
            <label>End<input name="endDate" type="date" /></label>
            <label>KPI target<input name="kpiTarget" placeholder="e.g. 15 qualified mill inquiries at ≤ $150 CPL" /></label>
          </div>
          <label>Objective<textarea name="objective" required /></label>
          <label>Notes<textarea name="notes" /></label>
          <button className="primary">Save draft</button>
        </form>
      </div>
    </>
  );
}
