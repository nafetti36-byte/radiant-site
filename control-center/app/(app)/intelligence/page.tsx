import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { Badge, fmtDate } from "@/components/ui.tsx";
import { addResearch } from "../actions.ts";

const CATS = ["market", "competitor", "keyword", "trend", "customer", "regulation"];

export default async function IntelPage({ searchParams }: { searchParams: Promise<{ e?: string; c?: string }> }) {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const { e, c } = await searchParams;
  const conds = [eq(schema.researchItems.brandId, brand.id)];
  if (e) conds.push(eq(schema.researchItems.evidenceType, e));
  if (c) conds.push(eq(schema.researchItems.category, c));
  const rows = await db.select().from(schema.researchItems).where(and(...conds)).orderBy(desc(schema.researchItems.createdAt)).limit(200);
  return (
    <>
      <h1>{t.intelligence}</h1>
      <p className="muted"><Badge s="verified" label={t.verified} /> = backed by a source the agent actually retrieved (or you entered with a URL). <Badge s="estimate" label={t.estimate} /> = derived/indicative figure. <Badge s="assumption" label={t.assumption} /> = hypothesis to test. Agent-claimed “verified” items whose URL was not retrieved in that run are automatically downgraded to estimate.</p>
      <p className="small">Research is produced by the <Link href="/agents/market-research">Market Research</Link>, <Link href="/agents/competitor-intel">Competitor Intelligence</Link>, <Link href="/agents/consumer-behavior">Consumer Behavior</Link>, <Link href="/agents/seo">SEO</Link> and <Link href="/agents/legal">Legal</Link> agents.</p>
      <div className="inline small" style={{ marginBottom: 10 }}>
        Filter: <Link href="/intelligence">all</Link>{["verified", "estimate", "assumption"].map((x) => <Link key={x} href={`/intelligence?e=${x}`}>{x}</Link>)} | {CATS.map((x) => <Link key={x} href={`/intelligence?c=${x}`}>{x}</Link>)}
      </div>
      <div className="card"><table><thead><tr><th>Evidence</th><th>Category</th><th>Finding</th><th>By</th><th>Date</th></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={5} className="muted">No findings yet.</td></tr> : rows.map((r) => (
          <tr key={r.id}><td><Badge s={r.evidenceType} /></td><td>{r.category}</td>
            <td><b>{r.topic}</b><div className="small">{r.finding}</div>{r.sourceUrl && <a className="small" href={r.sourceUrl} target="_blank" rel="noreferrer noopener">{r.sourceTitle || r.sourceUrl}</a>}</td>
            <td className="small">{r.agentSlug ?? "CEO (manual)"}</td><td className="small muted">{fmtDate(r.createdAt)}</td></tr>
        ))}</tbody></table></div>
      <div className="card">
        <h2>Add a finding manually</h2>
        <form action={addResearch}>
          <input type="hidden" name="brandId" value={brand.id} />
          <div className="grid g3">
            <label>Category<select name="category">{CATS.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Evidence<select name="evidenceType"><option>verified</option><option>estimate</option><option>assumption</option></select></label>
            <label>Topic<input name="topic" required /></label>
            <label>Source URL (required for verified)<input name="sourceUrl" type="url" /></label>
            <label>Source title<input name="sourceTitle" /></label>
          </div>
          <label>Finding<textarea name="finding" required /></label>
          <button className="primary">{t.save}</button>
        </form>
      </div>
    </>
  );
}
