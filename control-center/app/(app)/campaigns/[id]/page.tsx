import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { Badge, fmtDate, fmtMoney } from "@/components/ui.tsx";
import { setCampaignStatus, submitCampaignForApproval } from "../../actions.ts";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [c] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
  if (!c) notFound();
  const approvals = await db.select().from(schema.approvals).where(and(eq(schema.approvals.subjectType, "campaign"), eq(schema.approvals.subjectId, id))).orderBy(desc(schema.approvals.createdAt));
  const metrics = await db.select({ metric: schema.metricEntries.metric, total: sql<string>`sum(${schema.metricEntries.value})` }).from(schema.metricEntries).where(eq(schema.metricEntries.campaignId, id)).groupBy(schema.metricEntries.metric);
  const content = await db.select().from(schema.contentItems).where(eq(schema.contentItems.campaignId, id));
  const m = Object.fromEntries(metrics.map((x) => [x.metric, Number(x.total)]));
  const next: Record<string, string[]> = { approved: ["live"], live: ["paused", "completed"], paused: ["live", "completed"] };
  return (
    <>
      <p className="small"><Link href="/campaigns">← Campaigns</Link></p>
      <h1>{c.name} <Badge s={c.status} /></h1>
      <div className="grid g2">
        <div className="card">
          <h2>Plan</h2>
          <table><tbody>
            <tr><th>Objective</th><td className="pre">{c.objective}</td></tr>
            <tr><th>Channel</th><td>{c.channel}</td></tr><tr><th>Market</th><td>{c.market ?? "—"}</td></tr>
            <tr><th>Language</th><td>{c.language}</td></tr><tr><th>Budget</th><td>{fmtMoney(Number(c.budget), c.currency)}</td></tr>
            <tr><th>Dates</th><td>{c.startDate ?? "?"} → {c.endDate ?? "?"}</td></tr><tr><th>KPI target</th><td>{c.kpiTarget ?? "—"}</td></tr>
            <tr><th>Notes</th><td className="pre">{c.notes ?? "—"}</td></tr>
          </tbody></table>
          <div className="inline" style={{ marginTop: 12 }}>
            {["draft", "rejected"].includes(c.status) && <form action={submitCampaignForApproval}><input type="hidden" name="campaignId" value={c.id} /><button className="primary">Submit for CEO approval</button></form>}
            {(next[c.status] ?? []).map((s) => <form key={s} action={setCampaignStatus}><input type="hidden" name="campaignId" value={c.id} /><input type="hidden" name="status" value={s} /><button>Mark {s}</button></form>)}
          </div>
        </div>
        <div className="card">
          <h2>Verified results</h2>
          {metrics.length === 0 ? <p className="muted">No results recorded for this campaign. Link metric entries to it under Data &amp; Metrics.</p> : (
            <table><tbody>
              {Object.entries(m).map(([k, v]) => <tr key={k}><th>{k}</th><td>{v.toLocaleString()}</td></tr>)}
              {m.ad_spend && m.attributed_revenue ? <tr><th>ROAS</th><td>{(m.attributed_revenue / m.ad_spend).toFixed(2)}×</td></tr> : null}
              {m.ad_spend && m.leads ? <tr><th>Cost per lead</th><td>{fmtMoney(m.ad_spend / m.leads, c.currency)}</td></tr> : null}
            </tbody></table>
          )}
          <h3 style={{ marginTop: 14 }}>Approval history</h3>
          {approvals.length === 0 ? <p className="muted">Not submitted yet.</p> : <ul>{approvals.map((a) => <li key={a.id}><Link href={`/approvals/${a.id}`}>#{a.id}</Link> <Badge s={a.status} /> <span className="small muted">{fmtDate(a.createdAt)}{a.decisionReason ? ` — ${a.decisionReason}` : ""}</span></li>)}</ul>}
          <h3>Content</h3>
          {content.length === 0 ? <p className="muted">No linked content.</p> : <ul>{content.map((x) => <li key={x.id}>{x.title} <Badge s={x.status} /></li>)}</ul>}
        </div>
      </div>
    </>
  );
}
