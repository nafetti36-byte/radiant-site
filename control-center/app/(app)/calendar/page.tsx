import Link from "next/link";
import { and, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { Badge } from "@/components/ui.tsx";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const m = (await searchParams).m;
  const base = m && /^\d{4}-\d{2}$/.test(m) ? new Date(`${m}-01T00:00:00Z`) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const start = new Date(base); start.setUTCDate(1 - ((start.getUTCDay() + 6) % 7)); // Monday grid start
  const end = new Date(start.getTime() + 42 * 86400000);
  const [content, campaigns] = await Promise.all([
    db.select().from(schema.contentItems).where(and(eq(schema.contentItems.brandId, brand.id), gte(schema.contentItems.scheduledFor, start), lt(schema.contentItems.scheduledFor, end))),
    db.select().from(schema.campaigns).where(eq(schema.campaigns.brandId, brand.id)),
  ]);
  const ym = (d: Date) => d.toISOString().slice(0, 7);
  const prev = new Date(base); prev.setUTCMonth(prev.getUTCMonth() - 1);
  const next = new Date(base); next.setUTCMonth(next.getUTCMonth() + 1);
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86400000));
  return (
    <>
      <h1>{t.calendar}</h1>
      <div className="inline" style={{ marginBottom: 10 }}><Link href={`/calendar?m=${ym(prev)}`}>←</Link><b>{base.toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" })}</b><Link href={`/calendar?m=${ym(next)}`}>→</Link></div>
      <div className="cal" style={{ marginBottom: 4 }}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="small muted">{d}</div>)}</div>
      <div className="cal">
        {days.map((d) => {
          const iso = d.toISOString().slice(0, 10);
          const items = content.filter((c) => c.scheduledFor?.toISOString().slice(0, 10) === iso);
          const camps = campaigns.filter((c) => c.startDate && c.startDate <= iso && (c.endDate ?? c.startDate) >= iso);
          return (
            <div key={iso} className={`d ${d.getUTCMonth() !== base.getUTCMonth() ? "out" : ""}`}>
              <div className="muted">{d.getUTCDate()}</div>
              {camps.map((c) => <div key={`c${c.id}`}><Link href={`/campaigns/${c.id}`}>▬ {c.name}</Link></div>)}
              {items.map((c) => <div key={c.id}><Link href={`/content?edit=${c.id}`}>{c.title.slice(0, 28)}</Link> <Badge s={c.status} /></div>)}
            </div>
          );
        })}
      </div>
    </>
  );
}
