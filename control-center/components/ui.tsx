const TONE: Record<string, string> = {
  done: "b-ok", approved: "b-ok", live: "b-ok", published: "b-ok", completed: "b-ok", ok: "b-ok", verified: "b-ok", ready: "b-ok", "connected-config": "b-ok",
  needs_review: "b-info", running: "b-info", pending: "b-warn", pending_approval: "b-warn", in_review: "b-warn", queued: "b-info", scheduled: "b-info", started: "b-info", generating: "b-info", estimate: "b-warn",
  awaiting_credentials: "b-warn", "awaiting-credentials": "b-warn", skipped: "b-warn", missing: "b-warn", paused: "b-warn", assumption: "b-warn",
  failed: "b-bad", rejected: "b-bad", error: "b-bad", cancelled: "b-bad",
};
export function Badge({ s, label }: { s: string; label?: string }) {
  return <span className={`badge ${TONE[s] ?? ""}`}>{label ?? s.replace(/[_-]/g, " ")}</span>;
}

export function fmtMoney(v: number | null | undefined, cur = "USD") {
  if (v == null) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
}
export function fmtNum(v: number | null | undefined, digits = 0) {
  return v == null ? null : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(v);
}
export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function Kpi({ label, value, source, na }: { label: string; value: string | null; source?: string; na: string }) {
  return (
    <div className="card kpi" style={{ marginBottom: 0 }}>
      <div className="label">{label}</div>
      <div className={`val ${value == null ? "na" : ""}`}>{value ?? na}</div>
      {source && <div className="src">{source}</div>}
    </div>
  );
}
