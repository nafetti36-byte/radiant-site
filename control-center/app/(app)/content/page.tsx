import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { getActiveBrand, getT } from "@/lib/context.ts";
import { aiConfigured } from "@/lib/ai.ts";
import { CHANNELS, CONTENT_TYPES } from "@/lib/constants.ts";
import { Markdown } from "@/components/Markdown.tsx";
import { Badge, fmtDate } from "@/components/ui.tsx";
import { generateContent, markContentPublished, requestPublication, saveContent } from "../actions.ts";

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { t } = await getT();
  const brand = (await getActiveBrand())!;
  const editId = Number((await searchParams).edit) || null;
  const [items, campaigns] = await Promise.all([
    db.select().from(schema.contentItems).where(eq(schema.contentItems.brandId, brand.id)).orderBy(desc(schema.contentItems.updatedAt)).limit(100),
    db.select().from(schema.campaigns).where(eq(schema.campaigns.brandId, brand.id)),
  ]);
  const editing = editId ? items.find((i) => i.id === editId) : undefined;
  const toLocal = (d: Date | null | undefined) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  return (
    <>
      <h1>{t.content}</h1>
      <p className="muted">Brand-consistent drafts in {brand.languages.join(" / ")}. Flow: draft → in review → (publication approval) → approved → published. Publishing is done by you on the platform; record the live URL as evidence.</p>
      <div className="grid g2">
        <div className="card">
          <h2>Generate with an agent</h2>
          {!aiConfigured() && <div className="notice">Engine not configured — the request will be queued as a task awaiting credentials.</div>}
          <form action={generateContent}>
            <input type="hidden" name="brandId" value={brand.id} />
            <div className="grid g3">
              <label>Type<select name="type">{CONTENT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>Language<select name="language">{brand.languages.map((l) => <option key={l}>{l}</option>)}</select></label>
              <label>Channel<select name="channel">{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
            <label>Topic / angle<input name="topic" required /></label>
            <label>Audience<input name="audience" placeholder="e.g. procurement managers at tissue mills in KSA" /></label>
            <button className="primary">Generate draft</button>
          </form>
        </div>
        <div className="card">
          <h2>{editing ? `Edit #${editing.id}` : "Write manually"}</h2>
          <form action={saveContent}>
            <input type="hidden" name="brandId" value={brand.id} />{editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid g3">
              <label>Type<select name="type" defaultValue={editing?.type}>{CONTENT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>Language<select name="language" defaultValue={editing?.language}>{["en", "ar", "fr"].map((l) => <option key={l}>{l}</option>)}</select></label>
              <label>Channel<select name="channel" defaultValue={editing?.channel ?? ""}><option value="">—</option>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label>Campaign<select name="campaignId" defaultValue={editing?.campaignId ?? ""}><option value="">—</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>Planned date<input type="datetime-local" name="scheduledFor" defaultValue={toLocal(editing?.scheduledFor)} /></label>
              <label>Stage<select name="status" defaultValue={editing && ["idea", "draft", "in_review"].includes(editing.status) ? editing.status : "draft"}><option>idea</option><option>draft</option><option>in_review</option></select></label>
            </div>
            <label>Title<input name="title" required defaultValue={editing?.title} /></label>
            <label>Body<textarea name="body" rows={10} defaultValue={editing?.body} dir="auto" /></label>
            <button className="primary">{t.save}</button>
          </form>
        </div>
      </div>
      <div className="card">
        <h2>Library</h2>
        {items.length === 0 ? <p className="muted">No content yet.</p> : items.map((c) => (
          <details key={c.id} className="card" style={{ marginBottom: 8 }}>
            <summary><Badge s={c.status} /> <b>{c.title}</b> <span className="small muted">· {c.type} · {c.language} · {c.channel ?? "—"} · {c.scheduledFor ? `planned ${fmtDate(c.scheduledFor)}` : "unscheduled"}</span></summary>
            <div dir="auto"><Markdown text={c.body || "_(empty)_"} /></div>
            <div className="inline">
              <a className="btn" href={`/content?edit=${c.id}`}>Edit</a>
              {["draft", "in_review"].includes(c.status) && <form action={requestPublication}><input type="hidden" name="contentId" value={c.id} /><button className="primary">Request publication approval</button></form>}
              {["approved", "scheduled"].includes(c.status) && <form action={markContentPublished} className="inline"><input type="hidden" name="contentId" value={c.id} /><input name="url" type="url" required placeholder="Live URL (evidence)" style={{ width: 260 }} /><button>Record as published</button></form>}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
