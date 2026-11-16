import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { aiConfigured } from "@/lib/ai.ts";
import { getT } from "@/lib/context.ts";
import { Markdown } from "@/components/Markdown.tsx";
import { Badge, fmtDate, fmtMoney } from "@/components/ui.tsx";
import { decideApproval, regenerateRecommendations, saveManualRecommendations } from "../../actions.ts";

const BOARD: { col: "recMarketing" | "recFinancial" | "recLegal" | "recRisk"; title: string }[] = [
  { col: "recMarketing", title: "AI Marketing Director Recommendation" },
  { col: "recFinancial", title: "Financial & Economic Advisor Recommendation" },
  { col: "recLegal", title: "Legal Advisor Recommendation" },
  { col: "recRisk", title: "Risk Manager Recommendation" },
];

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getT();
  const id = Number((await params).id);
  const [a] = await db.select().from(schema.approvals).where(eq(schema.approvals.id, id));
  if (!a) notFound();
  const complete = BOARD.every((b) => a[b.col]);
  return (
    <>
      <p className="small"><Link href="/approvals">← {t.approvals}</Link></p>
      <h1>{a.title} <Badge s={a.status} /></h1>
      <p className="muted small">#{a.id} · {a.subjectType} · {a.amount ? fmtMoney(Number(a.amount), a.currency ?? "USD") : "no direct spend"} · created {fmtDate(a.createdAt)}</p>
      <div className="card"><h2>Proposal</h2><div className="pre">{a.description}</div></div>
      {a.recStatus === "generating" && <div className="notice info">The approval board is preparing recommendations. Refresh in a minute.</div>}
      {a.recStatus === "failed" && <div className="notice">Recommendation generation failed — see the audit log. You can retry or enter assessments manually.</div>}
      {!aiConfigured() && a.recStatus === "missing" && <div className="notice">AI engine not configured, so recommendations were not generated. Enter the four assessments manually below (or configure the engine and retry). Approval stays locked until all four exist.</div>}
      <div className="grid g2">
        {BOARD.map((b) => (
          <div className="card" key={b.col}><h2>{b.title}</h2>{a[b.col] ? <Markdown text={a[b.col]!} /> : <p className="muted">Not provided yet.</p>}</div>
        ))}
      </div>
      <p className="small muted">Recommendation source: {a.recSource}. AI recommendations are decision support, not professional legal or financial advice.</p>

      {a.status === "pending" ? (
        <div className="card">
          <h2>CEO decision</h2>
          <form action={decideApproval}>
            <input type="hidden" name="approvalId" value={a.id} />
            <label>{t.reason} (required to reject; recorded either way)<textarea name="reason" /></label>
            <div className="inline">
              <button className="ok" name="decision" value="approved" disabled={!complete}>{t.approve}</button>
              <button className="danger" name="decision" value="rejected">{t.reject}</button>
              {!complete && <span className="small muted">APPROVE unlocks when all four recommendations are present.</span>}
            </div>
            <p className="small muted">Approving authorises only the specific action described above. The system will not spend or publish on its own; execution is recorded separately.</p>
          </form>
        </div>
      ) : (
        <div className="card"><h2>Decision</h2><p><Badge s={a.status} /> by {a.decidedBy} on {fmtDate(a.decidedAt)}</p>{a.decisionReason && <p className="pre">{a.decisionReason}</p>}</div>
      )}

      {a.status === "pending" && (
        <div className="card">
          <details>
            <summary><b>Edit / enter recommendations manually</b></summary>
            <form action={saveManualRecommendations}>
              <input type="hidden" name="approvalId" value={a.id} />
              {BOARD.map((b) => <label key={b.col}>{b.title}<textarea name={b.col} defaultValue={a[b.col] ?? ""} /></label>)}
              <button>Save</button>
            </form>
          </details>
          {aiConfigured() && <form action={regenerateRecommendations} style={{ marginTop: 10 }}><input type="hidden" name="approvalId" value={a.id} /><button>Regenerate AI recommendations</button></form>}
        </div>
      )}
    </>
  );
}
