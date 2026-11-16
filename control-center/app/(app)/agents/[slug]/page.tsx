import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { AGENT_BY_SLUG } from "@/lib/agents.ts";
import { getActiveBrand } from "@/lib/context.ts";
import { aiConfigured } from "@/lib/ai.ts";
import { Markdown } from "@/components/Markdown.tsx";
import { Badge, fmtDate } from "@/components/ui.tsx";
import { createTask, deliverableToContent, runTaskAction, setTaskStatus } from "../../actions.ts";

export default async function AgentWorkspace({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = AGENT_BY_SLUG[slug];
  if (!agent) notFound();
  const brand = (await getActiveBrand())!;
  const tasks = await db.select().from(schema.tasks).where(and(eq(schema.tasks.brandId, brand.id), eq(schema.tasks.agentSlug, slug))).orderBy(desc(schema.tasks.createdAt)).limit(50);
  const dels = tasks.length ? await db.select().from(schema.deliverables).where(inArray(schema.deliverables.taskId, tasks.map((t) => t.id))).orderBy(desc(schema.deliverables.createdAt)) : [];
  const research = await db.select().from(schema.researchItems).where(and(eq(schema.researchItems.brandId, brand.id), eq(schema.researchItems.agentSlug, slug))).orderBy(desc(schema.researchItems.createdAt)).limit(20);
  const history = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.brandId, brand.id), eq(schema.auditLogs.entityType, "task"), inArray(schema.auditLogs.entityId, tasks.length ? tasks.map((t) => String(t.id)) : ["-"]))).orderBy(desc(schema.auditLogs.createdAt)).limit(40);
  const approvals = ["cmo", "finance", "legal", "risk"].includes(slug)
    ? await db.select().from(schema.approvals).where(and(eq(schema.approvals.brandId, brand.id), eq(schema.approvals.status, "pending"))).orderBy(desc(schema.approvals.createdAt))
    : [];
  return (
    <>
      <p className="small"><Link href="/agents">← Team</Link></p>
      <h1>{agent.num}. {agent.name}</h1>
      <p className="muted">{agent.mission}</p>
      <div className="grid g3">
        <div className="card"><h3>Responsibilities</h3><ul>{agent.responsibilities.map((r) => <li key={r}>{r}</li>)}</ul></div>
        <div className="card"><h3>Operating procedure</h3><ul>{agent.sop.map((r) => <li key={r}>{r}</li>)}</ul></div>
        <div className="card"><h3>KPIs &amp; tools</h3><ul>{agent.kpis.map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="small muted">Tools: {agent.tools.join(", ") || "none"}{agent.webResearch ? " · Claude web search" : ""}</p></div>
      </div>

      <div className="card">
        <h2>Assign a task</h2>
        <form action={createTask}>
          <input type="hidden" name="brandId" value={brand.id} /><input type="hidden" name="agentSlug" value={slug} />
          <div className="grid g2"><label>Title<input name="title" required minLength={3} /></label>
            <label>Priority<select name="priority"><option>normal</option><option>high</option><option>low</option></select></label></div>
          <label>Brief<textarea name="brief" required minLength={10} placeholder="What you need, for which market/language, constraints, deadline." /></label>
          <div className="inline"><label className="inline" style={{ margin: 0 }}><input type="checkbox" name="runNow" defaultChecked style={{ width: "auto" }} /> Run immediately</label>
            <button className="primary" type="submit">Create task</button>
            {!aiConfigured() && <span className="small muted">Engine not configured — the task will be stored as awaiting credentials.</span>}</div>
        </form>
      </div>

      {approvals.length > 0 && <div className="card"><h2>Approval requests needing this advisor&apos;s view</h2>
        <ul>{approvals.map((a) => <li key={a.id}><Link href={`/approvals/${a.id}`}>{a.title}</Link> <Badge s={a.recStatus} /></li>)}</ul></div>}

      <div className="card">
        <h2>Tasks</h2>
        {tasks.length === 0 ? <p className="muted">No tasks yet.</p> : <table><thead><tr><th>Task</th><th>Status</th><th>Source</th><th>Updated</th><th /></tr></thead><tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>{t.title}<div className="small muted">{t.brief.slice(0, 160)}{t.brief.length > 160 ? "…" : ""}</div>{t.error && <div className="small" style={{ color: "var(--bad)" }}>{t.error}</div>}</td>
              <td><Badge s={t.status} /></td><td className="small">{t.source}</td><td className="small muted">{fmtDate(t.updatedAt)}</td>
              <td className="inline">
                {["queued", "failed", "awaiting_credentials"].includes(t.status) && <form action={runTaskAction}><input type="hidden" name="taskId" value={t.id} /><button>Run</button></form>}
                {t.status === "needs_review" && <form action={setTaskStatus}><input type="hidden" name="taskId" value={t.id} /><input type="hidden" name="status" value="done" /><button className="ok">Accept</button></form>}
                {!["done", "cancelled"].includes(t.status) && <form action={setTaskStatus}><input type="hidden" name="taskId" value={t.id} /><input type="hidden" name="status" value="cancelled" /><button>Cancel</button></form>}
              </td>
            </tr>))}
        </tbody></table>}
      </div>

      <div className="card">
        <h2>Deliverables</h2>
        {dels.length === 0 ? <p className="muted">No deliverables yet. Deliverables appear only after a real model run.</p> : dels.map((d) => (
          <details key={d.id} className="card" style={{ marginBottom: 8 }}>
            <summary><b>{d.title}</b> <span className="small muted">· {fmtDate(d.createdAt)} · {d.model} · {d.inputTokens}+{d.outputTokens} tokens · {d.sources.length} web sources</span></summary>
            <Markdown text={d.body} />
            {d.sources.length > 0 && <><h3>Sources retrieved in this run</h3><ul className="small">{d.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer noopener">{s.title || s.url}</a></li>)}</ul></>}
            <form action={deliverableToContent} className="inline">
              <input type="hidden" name="deliverableId" value={d.id} />
              <select name="type" defaultValue="web_copy">{["social_post", "ad", "email", "web_copy", "video_script", "seo_article", "product_description"].map((x) => <option key={x}>{x}</option>)}</select>
              <select name="language" defaultValue="en"><option>en</option><option>ar</option><option>fr</option></select>
              <button>Send to Content Studio</button>
            </form>
          </details>
        ))}
      </div>

      {research.length > 0 && <div className="card"><h2>Research findings</h2><table><tbody>{research.map((r) => (
        <tr key={r.id}><td><Badge s={r.evidenceType} /></td><td><b>{r.topic}</b><div className="small">{r.finding}</div>{r.sourceUrl && <a className="small" href={r.sourceUrl} target="_blank" rel="noreferrer noopener">{r.sourceTitle || r.sourceUrl}</a>}</td></tr>
      ))}</tbody></table></div>}

      <div className="card"><h2>Execution history</h2>
        {history.length === 0 ? <p className="muted">No executions recorded.</p> : <table><tbody>{history.map((h) => (
          <tr key={h.id}><td className="small muted">{fmtDate(h.createdAt)}</td><td>{h.action}</td><td className="small">task #{h.entityId}</td><td className="small muted">{h.actor}</td><td className="small muted">{JSON.stringify(h.details).slice(0, 160)}</td></tr>
        ))}</tbody></table>}
      </div>
    </>
  );
}
