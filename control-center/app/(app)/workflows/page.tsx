import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { AGENT_BY_SLUG } from "@/lib/agents.ts";
import { aiConfigured } from "@/lib/ai.ts";
import { Badge, fmtDate } from "@/components/ui.tsx";
import { runWorkflowNow, updateWorkflow } from "../actions.ts";

export default async function WorkflowsPage() {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const wfs = await db.select().from(schema.workflows).where(eq(schema.workflows.brandId, brand.id)).orderBy(schema.workflows.id);
  const runs = wfs.length ? await db.select().from(schema.workflowRuns).where(inArray(schema.workflowRuns.workflowId, wfs.map((w) => w.id))).orderBy(desc(schema.workflowRuns.startedAt)).limit(100) : [];
  const schedulerRuns = runs.length;
  const cronConfigured = Boolean(process.env.CRON_SECRET);
  return (
    <>
      <h1>{t.workflows}</h1>
      <div className={`notice ${cronConfigured && aiConfigured() ? "info" : ""}`}>
        <b>Operating status (truthful):</b> scheduler endpoint {cronConfigured ? "is protected and ready" : "needs CRON_SECRET"}; agent engine {aiConfigured() ? "configured" : "NOT configured"}; {wfs.filter((w) => w.enabled).length} of {wfs.length} workflows enabled; {schedulerRuns} runs recorded.
        Workflows only run when this app is deployed with a scheduler calling <code>/api/cron</code> (e.g. Vercel Cron in <code>vercel.json</code>). Nothing runs “24/7” until those runs appear below.
      </div>
      <div className="card"><table><thead><tr><th>Workflow</th><th>Agent</th><th>Schedule (UTC cron)</th><th>Next / last run</th><th /></tr></thead>
        <tbody>{wfs.map((w) => (
          <tr key={w.id}>
            <td colSpan={5} style={{ padding: 0 }}>
              <form action={updateWorkflow} style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr 1.3fr auto", gap: 8, padding: "8px 6px", alignItems: "start" }}>
                <input type="hidden" name="id" value={w.id} />
                <div><b>{w.name}</b><textarea name="brief" defaultValue={w.brief} rows={2} style={{ minHeight: 50, marginTop: 4 }} /></div>
                <div><Link href={`/agents/${w.agentSlug}`}>{AGENT_BY_SLUG[w.agentSlug]?.name}</Link></div>
                <div><input name="schedule" defaultValue={w.schedule} /><label className="inline small" style={{ marginTop: 6 }}><input type="checkbox" name="enabled" defaultChecked={w.enabled} style={{ width: "auto" }} /> enabled</label></div>
                <div className="small">next: {w.enabled ? fmtDate(w.nextRunAt) : "disabled"}<br />last: {fmtDate(w.lastRunAt)}</div>
                <div className="inline"><button>{t.save}</button><button formAction={runWorkflowNow}>{t.run} now</button></div>
              </form>
            </td>
          </tr>
        ))}</tbody></table></div>
      <div className="card"><h2>Execution log</h2>
        {runs.length === 0 ? <p className="muted">No workflow has run yet.</p> : <table><tbody>{runs.map((r) => (
          <tr key={r.id}><td className="small muted">{fmtDate(r.startedAt)}</td><td>{wfs.find((w) => w.id === r.workflowId)?.name}</td><td><Badge s={r.status} /></td><td className="small">task #{r.taskId}</td><td className="small muted">{r.message ?? ""}</td></tr>
        ))}</tbody></table>}
      </div>
    </>
  );
}
