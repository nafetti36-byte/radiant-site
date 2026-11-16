import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { Badge, fmtDate, fmtMoney } from "@/components/ui.tsx";
import { createApprovalRequest } from "../actions.ts";

export default async function ApprovalsPage() {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const rows = await db.select().from(schema.approvals).where(eq(schema.approvals.brandId, brand.id)).orderBy(desc(schema.approvals.createdAt)).limit(100);
  return (
    <>
      <h1>{t.approvals}</h1>
      <p className="muted">You are the final decision-maker. Each request carries four recommendations — AI Marketing Director, Financial &amp; Economic Advisor, Legal Advisor, Risk Manager — before APPROVE is enabled. Rejections require a reason. Every decision is written to the audit log.</p>
      <div className="card"><table><thead><tr><th>Request</th><th>Type</th><th>Amount</th><th>Recommendations</th><th>{t.status}</th><th>Created</th></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={6} className="muted">No approval requests.</td></tr> : rows.map((a) => (
          <tr key={a.id}><td><Link href={`/approvals/${a.id}`}>{a.title}</Link></td><td>{a.subjectType}</td><td>{a.amount ? fmtMoney(Number(a.amount), a.currency ?? brand.currency) : "—"}</td>
            <td><Badge s={a.recStatus} /></td><td><Badge s={a.status} /></td><td className="small muted">{fmtDate(a.createdAt)}</td></tr>
        ))}</tbody></table></div>
      <div className="card">
        <h2>Raise a spend / change request</h2>
        <form action={createApprovalRequest}>
          <input type="hidden" name="brandId" value={brand.id} />
          <div className="grid g3">
            <label>Type<select name="subjectType"><option value="spend">Spending request</option><option value="change">Significant marketing change</option><option value="publication">External publication</option></select></label>
            <label>Amount (optional)<input name="amount" type="number" step="0.01" /></label>
            <label>Currency<input name="currency" defaultValue={brand.currency} /></label>
          </div>
          <label>Title<input name="title" required /></label>
          <label>Description (what, why, expected impact, vendor, duration)<textarea name="description" required minLength={10} /></label>
          <button className="primary">Submit for recommendations</button>
        </form>
      </div>
    </>
  );
}
