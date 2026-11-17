import Link from "next/link";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { deriveKpis, metricTotals, rangeLastDays } from "@/lib/metrics.ts";
import { aiConfigured } from "@/lib/ai.ts";
import { PROVIDERS, providerStatus } from "@/lib/integrations/index.ts";
import { AGENT_BY_SLUG } from "@/lib/agents.ts";
import { Badge, fmtDate, fmtMoney, fmtNum } from "@/components/ui.tsx";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const days = Math.min(Math.max(Number((await searchParams).days) || 7, 1), 92);
  const r = rangeLastDays(days);
  const since = new Date(Date.now() - days * 86400000);
  const totals = await metricTotals(brand.id, r.from, r.to);
  const k = deriveKpis(totals);
  const [done, failed, waiting, newFindings, pending, decided, camps, auditN] = await Promise.all([
    db.select().from(schema.tasks).where(and(eq(schema.tasks.brandId, brand.id), inArray(schema.tasks.status, ["needs_review", "done"]), gte(schema.tasks.updatedAt, since))),
    db.select().from(schema.tasks).where(and(eq(schema.tasks.brandId, brand.id), eq(schema.tasks.status, "failed"), gte(schema.tasks.updatedAt, since))),
    db.select().from(schema.tasks).where(and(eq(schema.tasks.brandId, brand.id), eq(schema.tasks.status, "awaiting_credentials"))),
    db.select().from(schema.researchItems).where(and(eq(schema.researchItems.brandId, brand.id), gte(schema.researchItems.createdAt, since))).orderBy(desc(schema.researchItems.createdAt)),
    db.select().from(schema.approvals).where(and(eq(schema.approvals.brandId, brand.id), eq(schema.approvals.status, "pending"))),
    db.select().from(schema.approvals).where(and(eq(schema.approvals.brandId, brand.id), gte(schema.approvals.decidedAt, since))),
    db.select().from(schema.campaigns).where(and(eq(schema.campaigns.brandId, brand.id), inArray(schema.campaigns.status, ["live", "paused", "completed"]))),
    db.select({ id: schema.auditLogs.id }).from(schema.auditLogs).where(and(eq(schema.auditLogs.brandId, brand.id), gte(schema.auditLogs.createdAt, since))),
  ]);
  const problems: string[] = [];
  if (!aiConfigured()) problems.push("AI agent engine not configured (ANTHROPIC_API_KEY) — agents cannot execute.");
  for (const p of PROVIDERS) if (providerStatus(p) === "awaiting-credentials") problems.push(`${p.name}: awaiting credentials.`);
  if (failed.length) problems.push(`${failed.length} agent task(s) failed — review in agent workspaces.`);
  if (waiting.length) problems.push(`${waiting.length} task(s) waiting for credentials.`);
  if (totals.revenue === undefined) problems.push("No sales data recorded — revenue and profit cannot be reported.");
  const byAgent = Object.entries(done.reduce<Record<string, number>>((a, x) => ((a[x.agentSlug] = (a[x.agentSlug] ?? 0) + 1), a), {}));
  const cur = brand.currency;
  const v = (x: string | null) => x ?? "not recorded";
  return (
    <>
      <h1>{t.reports} — {brand.name}</h1>
      <p className="muted">Period {r.from} → {r.to} · generated {fmtDate(new Date())} · built only from database records ({auditN.length} audit events). <Link href="?days=7">7d</Link> · <Link href="?days=30">30d</Link> · <Link href="?days=90">90d</Link></p>
      <div className="card"><h2>1. Marketing activities actually completed</h2>
        {done.length === 0 ? <p className="muted">No agent deliverables in this period.</p> : <ul>{done.map((x) => <li key={x.id}>{AGENT_BY_SLUG[x.agentSlug]?.name}: {x.title} <Badge s={x.status} /></li>)}</ul>}
        {decided.length > 0 && <p>Decisions taken: {decided.map((a) => `${a.title} (${a.status})`).join("; ")}</p>}</div>
      <div className="card"><h2>2. Campaign performance (verified)</h2>
        {camps.length === 0 ? <p className="muted">No campaigns have been launched.</p> : <ul>{camps.map((c) => <li key={c.id}><Link href={`/campaigns/${c.id}`}>{c.name}</Link> <Badge s={c.status} /></li>)}</ul>}</div>
      <div className="card"><h2>3. New opportunities identified</h2>
        {newFindings.length === 0 ? <p className="muted">None recorded.</p> : <ul>{newFindings.slice(0, 15).map((f) => <li key={f.id}><Badge s={f.evidenceType} /> <b>{f.topic}</b> — {f.finding.slice(0, 220)}</li>)}</ul>}</div>
      <div className="card"><h2>4. Revenue, expenditure and profit</h2>
        <table><tbody>
          <tr><th>{t.totalSales}</th><td>{v(fmtMoney(totals.revenue, cur))}</td></tr>
          <tr><th>{t.attributedRevenue}</th><td>{v(fmtMoney(totals.attributed_revenue, cur))}</td></tr>
          <tr><th>{t.spend}</th><td>{v(fmtMoney(k.marketingSpend, cur))}</td></tr>
          <tr><th>{t.netProfit}</th><td>{v(fmtMoney(k.netOperatingProfit, cur))}</td></tr>
          <tr><th>{t.cac}</th><td>{v(fmtMoney(k.cac, cur))}</td></tr><tr><th>{t.roas}</th><td>{k.roas == null ? "not recorded" : `${k.roas.toFixed(2)}×`}</td></tr>
          <tr><th>{t.newLeads}</th><td>{v(fmtNum(totals.leads))}</td></tr>
        </tbody></table></div>
      <div className="card"><h2>5. Problems requiring intervention</h2>{problems.length ? <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="muted">None.</p>}</div>
      <div className="card"><h2>6. AI team productivity</h2>
        <p>{done.length} deliverables, {failed.length} failures, {waiting.length} waiting.</p>
        {byAgent.length > 0 && <ul>{byAgent.map(([s, n]) => <li key={s}>{AGENT_BY_SLUG[s]?.name}: {n}</li>)}</ul>}</div>
      <div className="card"><h2>7. Decisions awaiting your approval</h2>
        {pending.length === 0 ? <p className="muted">None.</p> : <ul>{pending.map((a) => <li key={a.id}><Link href={`/approvals/${a.id}`}>{a.title}</Link> {a.amount ? `— ${fmtMoney(Number(a.amount), a.currency ?? cur)}` : ""}</li>)}</ul>}</div>
      <div className="card"><h2>8. Next actions</h2>
        <ul>
          {problems.length > 0 && <li>Resolve the blockers in section 5 (highest priority: {problems[0]})</li>}
          {pending.length > 0 && <li>Decide on {pending.length} pending approval(s).</li>}
          <li>Review deliverables marked “needs review” in agent workspaces and accept or re-brief.</li>
          <li>See the 90-day plan in <code>docs/05-90-day-launch-plan.md</code> for the scheduled initiatives.</li>
        </ul></div>
    </>
  );
}
