import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getT } from "@/lib/context.ts";
import { fmtDate } from "@/components/ui.tsx";

export default async function AuditPage() {
  const { t } = await getT();
  const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(300);
  return (
    <>
      <h1>{t.audit}</h1>
      <p className="muted">Append-only record of every login-authenticated action, agent execution, integration call and approval decision.</p>
      <div className="card"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Brand</th><th>Details</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td className="small muted">{fmtDate(r.createdAt)}</td><td className="small">{r.actor}</td><td>{r.action}</td><td className="small">{r.entityType} #{r.entityId}</td><td>{r.brandId ?? "—"}</td><td className="small muted" style={{ maxWidth: 380, overflowWrap: "anywhere" }}>{JSON.stringify(r.details)}</td></tr>)}</tbody></table></div>
    </>
  );
}
