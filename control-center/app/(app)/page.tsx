import Link from "next/link";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { deriveKpis, metricTotals, rangeLastDays } from "@/lib/metrics.ts";
import { aiConfigured } from "@/lib/ai.ts";
import { AGENT_BY_SLUG } from "@/lib/agents.ts";
import { Badge, Kpi, fmtDate, fmtMoney, fmtNum } from "@/components/ui.tsx";

export default async function Dashboard() {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const r = rangeLastDays(30);
  const totals = await metricTotals(brand.id, r.from, r.to);
  const k = deriveKpis(totals);
  const src = (m: keyof typeof totals) => (totals._sources[m as string] ? `Source: ${totals._sources[m as string].join(", ")}` : undefined);
  const since = new Date(Date.now() - 30 * 86400000);
  const [[active], [doneTasks], [allTasks], pendingAps, recentTasks] = await Promise.all([
    db.select({ n: count() }).from(schema.campaigns).where(and(eq(schema.campaigns.brandId, brand.id), eq(schema.campaigns.status, "live"))),
    db.select({ n: count() }).from(schema.tasks).where(and(eq(schema.tasks.brandId, brand.id), inArray(schema.tasks.status, ["needs_review", "done"]), gte(schema.tasks.updatedAt, since))),
    db.select({ n: count() }).from(schema.tasks).where(and(eq(schema.tasks.brandId, brand.id), gte(schema.tasks.createdAt, since))),
    db.select().from(schema.approvals).where(and(eq(schema.approvals.brandId, brand.id), eq(schema.approvals.status, "pending"))).orderBy(desc(schema.approvals.createdAt)).limit(5),
    db.select().from(schema.tasks).where(eq(schema.tasks.brandId, brand.id)).orderBy(desc(schema.tasks.updatedAt)).limit(8),
  ]);
  const cur = brand.currency;
  return (
    <>
      <h1>{t.dashboard} — {brand.name}</h1>
      <p className="muted">{t.last30}: {r.from} → {r.to}. Every figure below is computed from recorded data only; empty tiles mean no data has been connected or entered.</p>
      {!aiConfigured() && <div className="notice">AI agent engine is <b>not configured</b> (ANTHROPIC_API_KEY missing). Agents will queue tasks but not execute them. See <Link href="/integrations">Integrations</Link>.</div>}
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <Kpi label={t.totalSales} value={fmtMoney(totals.revenue, cur)} source={src("revenue")} na={t.noData} />
        <Kpi label={t.attributedRevenue} value={fmtMoney(totals.attributed_revenue, cur)} source={src("attributed_revenue")} na={t.noData} />
        <Kpi label={t.spend} value={fmtMoney(k.marketingSpend, cur)} source={src("ad_spend")} na={t.noData} />
        <Kpi label={t.netProfit} value={fmtMoney(k.netOperatingProfit, cur)} source={k.netOperatingProfit == null ? "Needs gross profit data" : "Gross profit − marketing − opex"} na={t.noData} />
        <Kpi label={t.activeCampaigns} value={String(active.n)} source="Campaigns with status live" na={t.noData} />
        <Kpi label={t.newLeads} value={fmtNum(totals.leads)} source={src("leads")} na={t.noData} />
        <Kpi label={t.newCustomers} value={fmtNum(totals.new_customers)} source={src("new_customers")} na={t.noData} />
        <Kpi label={t.traffic} value={fmtNum(totals.sessions)} source={src("sessions")} na={t.noData} />
        <Kpi label={t.convRate} value={k.conversionRate == null ? null : `${(k.conversionRate * 100).toFixed(2)}%`} source="Conversions ÷ sessions" na={t.noData} />
        <Kpi label={t.cac} value={fmtMoney(k.cac, cur)} source="Marketing spend ÷ new customers" na={t.noData} />
        <Kpi label={t.roas} value={k.roas == null ? null : `${k.roas.toFixed(2)}×`} source="Attributed revenue ÷ ad spend" na={t.noData} />
        <Kpi label={t.agentActivity} value={`${doneTasks.n} / ${allTasks.n}`} source={`${t.tasksDone} / tasks created (30d)`} na={t.noData} />
      </div>
      <div className="grid g2">
        <div className="card">
          <h2>{t.pendingApprovals}</h2>
          {pendingAps.length === 0 ? <p className="muted">Nothing awaiting your decision.</p> : (
            <table><tbody>{pendingAps.map((a) => (
              <tr key={a.id}><td><Link href={`/approvals/${a.id}`}>{a.title}</Link></td><td>{a.amount ? fmtMoney(Number(a.amount), a.currency ?? cur) : "—"}</td><td><Badge s={a.recStatus} label={`recs: ${a.recStatus}`} /></td></tr>
            ))}</tbody></table>
          )}
        </div>
        <div className="card">
          <h2>Recent agent activity (actual)</h2>
          {recentTasks.length === 0 ? <p className="muted">No agent tasks yet. Assign one from <Link href="/agents">{t.agents}</Link>.</p> : (
            <table><tbody>{recentTasks.map((x) => (
              <tr key={x.id}><td><Link href={`/agents/${x.agentSlug}`}>{AGENT_BY_SLUG[x.agentSlug]?.name}</Link><div className="small muted">{x.title}</div></td><td><Badge s={x.status} /></td><td className="small muted">{fmtDate(x.updatedAt)}</td></tr>
            ))}</tbody></table>
          )}
        </div>
      </div>
    </>
  );
}
