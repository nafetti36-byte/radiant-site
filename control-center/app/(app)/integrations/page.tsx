import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { PROVIDERS, providerStatus } from "@/lib/integrations/index.ts";
import { Badge, fmtDate } from "@/components/ui.tsx";
import { IntegrationActions } from "@/components/IntegrationActions.tsx";

export default async function IntegrationsPage() {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const runs = await db.select().from(schema.integrationRuns).orderBy(desc(schema.integrationRuns.createdAt)).limit(200);
  const lastOk = (k: string) => runs.find((r) => r.provider === k && r.status === "ok");
  const lastAny = (k: string) => runs.find((r) => r.provider === k);
  return (
    <>
      <h1>{t.integrations}</h1>
      <p className="muted">Status is honest: <Badge s="connected-config" label="credentials present" /> means env vars are set — it becomes “verified” only after a successful test. <Badge s="awaiting-credentials" /> means code exists but you must provide access. <Badge s="planned" /> means not yet built. Credentials live in server environment variables, never in the database or the browser.</p>
      {PROVIDERS.map((p) => {
        const st = providerStatus(p);
        const ok = lastOk(p.key), last = lastAny(p.key);
        return (
          <div className="card" key={p.key}>
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <h2 style={{ margin: 0 }}>{p.name}</h2>
              <div className="inline"><Badge s={st} label={st === "connected-config" ? "credentials present" : undefined} />
                {ok ? <Badge s="ok" label={`verified ${fmtDate(ok.createdAt)}`} /> : st === "connected-config" ? <Badge s="pending" label="not yet verified" /> : null}
                <span className="badge">{p.category}</span><span className="badge">{p.implemented === "sync" ? "test + metric sync" : p.implemented === "test-only" ? "connection test" : "planned"}</span></div>
            </div>
            <div className="grid g2" style={{ marginTop: 8 }}>
              <div>
                <h3>Permissions you need to grant</h3><ul className="small">{p.permissions.map((x) => <li key={x}>{x}</li>)}</ul>
                <h3>Setup steps</h3><ol className="small">{p.setup.map((x) => <li key={x}>{x}</li>)}</ol>
              </div>
              <div>
                <h3>Environment variables</h3>
                <ul className="small">{p.envVars.map((v) => <li key={v}><code>{v}</code> {process.env[v]?.trim() ? "✓ set" : "✗ missing"}</li>)}</ul>
                {p.metrics && <p className="small muted">Writes metrics: {p.metrics.join(", ")}</p>}
                {p.implemented !== "planned" && <IntegrationActions provider={p.key} brandId={brand.id} canTest={st === "connected-config"} canSync={p.implemented === "sync" && st === "connected-config"} />}
                {last && <p className="small muted">Last run: {last.kind} {last.status} — {fmtDate(last.createdAt)} — {last.message?.slice(0, 160)}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
