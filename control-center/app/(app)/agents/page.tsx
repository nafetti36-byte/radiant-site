import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { AGENTS } from "@/lib/agents.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { aiConfigured } from "@/lib/ai.ts";

export default async function AgentsPage() {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const stats = await db.select({ slug: schema.tasks.agentSlug, status: schema.tasks.status, n: count() })
    .from(schema.tasks).where(eq(schema.tasks.brandId, brand.id)).groupBy(schema.tasks.agentSlug, schema.tasks.status);
  const by = (slug: string, s: string[]) => stats.filter((x) => x.slug === slug && s.includes(x.status)).reduce((a, b) => a + b.n, 0);
  const depts = [...new Set(AGENTS.map((a) => a.department))];
  return (
    <>
      <h1>{t.agents}</h1>
      <p className="muted">20 specialist roles + the Risk Manager on the approval board. Each agent is a Claude-powered role with its own SOP. Agents act only when a task is assigned (by you or a scheduled workflow) and {aiConfigured() ? <b>the engine is configured</b> : <b>the engine is NOT configured yet — tasks will wait</b>}. They cannot publish, send or spend.</p>
      {depts.map((d) => (
        <div className="card" key={d}>
          <h2>{d}</h2>
          <table>
            <thead><tr><th>#</th><th>Agent</th><th>Mission</th><th>Open</th><th>Delivered</th><th>Web research</th></tr></thead>
            <tbody>{AGENTS.filter((a) => a.department === d).map((a) => (
              <tr key={a.slug}>
                <td>{a.num}</td>
                <td><Link href={`/agents/${a.slug}`}>{a.name}</Link></td>
                <td className="small">{a.mission}</td>
                <td>{by(a.slug, ["queued", "running", "awaiting_credentials", "needs_review"])}</td>
                <td>{by(a.slug, ["needs_review", "done"])}</td>
                <td>{a.webResearch ? "yes" : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ))}
    </>
  );
}
