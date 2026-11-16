import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getT } from "@/lib/context.ts";
import { fmtDate } from "@/components/ui.tsx";
import { markAllRead } from "../actions.ts";

export default async function NotificationsPage() {
  const { t } = await getT();
  const rows = await db.select().from(schema.notifications).orderBy(desc(schema.notifications.createdAt)).limit(100);
  return (
    <>
      <h1>{t.notifications}</h1>
      <form action={markAllRead}><button>Mark all read</button></form>
      <div className="card" style={{ marginTop: 10 }}>{rows.length === 0 ? <p className="muted">No notifications.</p> : <table><tbody>{rows.map((n) => (
        <tr key={n.id}><td>{n.read ? "" : "●"}</td><td>{n.link ? <Link href={n.link}>{n.title}</Link> : n.title}<div className="small muted">{n.body}</div></td><td className="small muted">{fmtDate(n.createdAt)}</td></tr>
      ))}</tbody></table>}</div>
    </>
  );
}
