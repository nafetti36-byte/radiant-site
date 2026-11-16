import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { requireUser } from "@/lib/auth.ts";
import { getActiveBrand, getBrands, getT } from "@/lib/context.ts";
import { LANGS, LANG_NAMES } from "@/lib/i18n.ts";
import { logout, setBrand, setLang } from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, lang } = await getT();
  const [brands, active] = await Promise.all([getBrands(), getActiveBrand()]);
  const [{ n: unread }] = await db.select({ n: count() }).from(schema.notifications).where(eq(schema.notifications.read, false));
  const [{ n: pending }] = await db.select({ n: count() }).from(schema.approvals).where(eq(schema.approvals.status, "pending"));
  const nav: [string, string][][] = [
    [["/", t.dashboard], ["/approvals", `${t.approvals}${pending ? ` (${pending})` : ""}`], ["/reports", t.reports]],
    [["/agents", t.agents], ["/workflows", t.workflows]],
    [["/campaigns", t.campaigns], ["/content", t.content], ["/calendar", t.calendar], ["/intelligence", t.intelligence]],
    [["/metrics", t.metrics], ["/integrations", t.integrations], ["/brands", t.brands], ["/audit", t.audit]],
  ];
  const secs = ["Executive", "AI Department", "Marketing", "Data & Admin"];
  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">◆ Control Center</div>
        {nav.map((group, i) => (
          <div key={i}>
            <div className="sec">{secs[i]}</div>
            {group.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
          </div>
        ))}
      </aside>
      <div className="main">
        <div className="top">
          <form action={setBrand}>
            <select key={active?.id} name="brandId" defaultValue={active?.id} aria-label="Brand">
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button type="submit">↻</button>
          </form>
          <div className="inline">
            <Link href="/notifications">{t.notifications}{unread ? ` (${unread})` : ""}</Link>
            <form action={setLang}>
              <select key={lang} name="lang" defaultValue={lang} aria-label="Language">
                {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
              </select>
              <button type="submit">✓</button>
            </form>
            <span className="muted small">{user.email}</span>
            <form action={logout}><button type="submit">{t.logout}</button></form>
          </div>
        </div>
        {active ? children : <div className="card">No brand configured. Run <code>npm run db:seed</code> or create one under <Link href="/brands">Brands</Link>.</div>}
      </div>
    </div>
  );
}
