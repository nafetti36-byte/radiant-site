"use server";
import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client.ts";
import { requireUser, endSession } from "@/lib/auth.ts";
import { audit, notify } from "@/lib/audit.ts";
import { runTask, generateApprovalRecommendations } from "@/lib/ai.ts";
import { AGENT_BY_SLUG } from "@/lib/agents.ts";
import { LANGS } from "@/lib/i18n.ts";
import { METRICS } from "@/lib/metrics.ts";
import { nextRun, parseCron } from "@/lib/cron.ts";
import { ensureDefaultWorkflows, triggerWorkflow } from "@/lib/workflows.ts";
import { syncProvider, testProvider } from "@/lib/integrations/index.ts";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;

// ── Session / preferences ───────────────────────────────────────────
export async function logout() { await endSession(); redirect("/login"); }

export async function setLang(fd: FormData) {
  await requireUser();
  const l = str(fd, "lang");
  if ((LANGS as readonly string[]).includes(l)) (await cookies()).set("lang", l, { path: "/", maxAge: 31536000, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setBrand(fd: FormData) {
  await requireUser();
  (await cookies()).set("brand", String(Number(str(fd, "brandId"))), { path: "/", maxAge: 31536000, sameSite: "lax" });
  revalidatePath("/", "layout");
}

// ── Brands ──────────────────────────────────────────────────────────
const BrandSchema = z.object({
  name: z.string().min(2).max(120), slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
  website: z.string().url().nullable(), industry: z.string().max(200).nullable(), description: z.string().max(4000).nullable(),
  voice: z.string().max(500).nullable(), currency: z.string().regex(/^[A-Z]{3}$/),
});
export async function createBrand(fd: FormData) {
  const u = await requireUser();
  const data = BrandSchema.parse({
    name: str(fd, "name"), slug: str(fd, "slug"), website: opt(fd, "website"), industry: opt(fd, "industry"),
    description: opt(fd, "description"), voice: opt(fd, "voice"), currency: str(fd, "currency") || "USD",
  });
  const markets = str(fd, "markets").split(",").map((s) => s.trim()).filter(Boolean);
  const languages = fd.getAll("languages").map(String).filter((l) => (LANGS as readonly string[]).includes(l));
  const [b] = await db.insert(schema.brands).values({ ...data, markets, languages: languages.length ? languages : ["en"] }).returning();
  await ensureDefaultWorkflows(b.id);
  await audit(u.email, "brand.create", "brand", b.id, b.id, { name: b.name });
  revalidatePath("/brands");
}

export async function updateBrand(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "id"));
  const markets = str(fd, "markets").split(",").map((s) => s.trim()).filter(Boolean);
  const languages = fd.getAll("languages").map(String).filter((l) => (LANGS as readonly string[]).includes(l));
  await db.update(schema.brands).set({
    website: opt(fd, "website"), industry: opt(fd, "industry"), description: opt(fd, "description"), voice: opt(fd, "voice"),
    markets, languages: languages.length ? languages : ["en"],
  }).where(eq(schema.brands.id, id));
  await audit(u.email, "brand.update", "brand", id, id, {});
  revalidatePath("/brands");
}

// ── Tasks / agents ──────────────────────────────────────────────────
export async function createTask(fd: FormData) {
  const u = await requireUser();
  const brandId = Number(str(fd, "brandId"));
  const agentSlug = str(fd, "agentSlug");
  if (!AGENT_BY_SLUG[agentSlug]) throw new Error("Unknown agent");
  const title = z.string().min(3).max(200).parse(str(fd, "title"));
  const brief = z.string().min(10).max(8000).parse(str(fd, "brief"));
  const [t] = await db.insert(schema.tasks).values({ brandId, agentSlug, title, brief, priority: str(fd, "priority") || "normal" }).returning();
  await audit(u.email, "task.create", "task", t.id, brandId, { agentSlug, title });
  if (fd.get("runNow")) after(() => runTask(t.id, u.email));
  revalidatePath(`/agents/${agentSlug}`);
}

export async function runTaskAction(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "taskId"));
  await db.update(schema.tasks).set({ status: "queued", error: null, updatedAt: new Date() }).where(eq(schema.tasks.id, id));
  after(() => runTask(id, u.email));
  revalidatePath("/agents", "layout");
}

export async function setTaskStatus(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "taskId"));
  const status = z.enum(["done", "cancelled", "queued"]).parse(str(fd, "status"));
  const [t] = await db.update(schema.tasks).set({ status, updatedAt: new Date() }).where(eq(schema.tasks.id, id)).returning();
  await audit(u.email, `task.${status}`, "task", id, t.brandId, {});
  revalidatePath("/agents", "layout");
}

/** Copy an agent deliverable into the Content Studio as a draft. */
export async function deliverableToContent(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "deliverableId"));
  const [d] = await db.select().from(schema.deliverables).where(eq(schema.deliverables.id, id));
  const [c] = await db.insert(schema.contentItems).values({
    brandId: d.brandId, type: str(fd, "type") || "web_copy", language: str(fd, "language") || "en",
    title: d.title, body: d.body, status: "in_review", agentSlug: d.agentSlug, taskId: d.taskId,
  }).returning();
  await audit(u.email, "content.from_deliverable", "content", c.id, d.brandId, { deliverableId: id });
  redirect(`/content?edit=${c.id}`);
}

// ── Campaigns & approvals ───────────────────────────────────────────
const CampaignSchema = z.object({
  name: z.string().min(3).max(200), objective: z.string().min(3).max(2000), channel: z.string().min(2).max(80),
  market: z.string().max(80).nullable(), language: z.enum(LANGS), budget: z.coerce.number().min(0).max(1e9),
  currency: z.string().regex(/^[A-Z]{3}$/), startDate: z.string().nullable(), endDate: z.string().nullable(),
  kpiTarget: z.string().max(500).nullable(), notes: z.string().max(4000).nullable(),
});
export async function createCampaign(fd: FormData) {
  const u = await requireUser();
  const brandId = Number(str(fd, "brandId"));
  const d = CampaignSchema.parse({
    name: str(fd, "name"), objective: str(fd, "objective"), channel: str(fd, "channel"), market: opt(fd, "market"),
    language: str(fd, "language") || "en", budget: str(fd, "budget") || "0", currency: str(fd, "currency") || "USD",
    startDate: opt(fd, "startDate"), endDate: opt(fd, "endDate"), kpiTarget: opt(fd, "kpiTarget"), notes: opt(fd, "notes"),
  });
  const [c] = await db.insert(schema.campaigns).values({ ...d, budget: String(d.budget), brandId }).returning();
  await audit(u.email, "campaign.create", "campaign", c.id, brandId, { name: c.name });
  redirect(`/campaigns/${c.id}`);
}

export async function submitCampaignForApproval(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "campaignId"));
  const [c] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
  if (!["draft", "rejected"].includes(c.status)) throw new Error("Only draft or rejected campaigns can be submitted");
  const [ap] = await db.insert(schema.approvals).values({
    brandId: c.brandId, subjectType: "campaign", subjectId: c.id, title: `Launch campaign: ${c.name}`,
    description: `Objective: ${c.objective}\nChannel: ${c.channel}\nMarket: ${c.market ?? "-"}\nLanguage: ${c.language}\nDates: ${c.startDate ?? "?"} → ${c.endDate ?? "?"}\nBudget: ${c.budget} ${c.currency}\nKPI target: ${c.kpiTarget ?? "-"}\nNotes: ${c.notes ?? "-"}`,
    amount: c.budget, currency: c.currency,
  }).returning();
  await db.update(schema.campaigns).set({ status: "pending_approval", updatedAt: new Date() }).where(eq(schema.campaigns.id, id));
  await audit(u.email, "approval.request", "approval", ap.id, c.brandId, { campaignId: id });
  await notify(c.brandId, `Approval requested: ${c.name}`, `${c.budget} ${c.currency}`, `/approvals/${ap.id}`);
  after(() => generateApprovalRecommendations(ap.id));
  redirect(`/approvals/${ap.id}`);
}

export async function createApprovalRequest(fd: FormData) {
  const u = await requireUser();
  const brandId = Number(str(fd, "brandId"));
  const subjectType = z.enum(["spend", "publication", "change"]).parse(str(fd, "subjectType"));
  const [ap] = await db.insert(schema.approvals).values({
    brandId, subjectType, title: z.string().min(3).parse(str(fd, "title")), description: z.string().min(10).parse(str(fd, "description")),
    amount: opt(fd, "amount"), currency: opt(fd, "currency"),
  }).returning();
  await audit(u.email, "approval.request", "approval", ap.id, brandId, { subjectType });
  after(() => generateApprovalRecommendations(ap.id));
  redirect(`/approvals/${ap.id}`);
}

export async function regenerateRecommendations(fd: FormData) {
  await requireUser();
  const id = Number(str(fd, "approvalId"));
  after(() => generateApprovalRecommendations(id));
  revalidatePath(`/approvals/${id}`);
}

export async function saveManualRecommendations(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "approvalId"));
  const vals = { recMarketing: opt(fd, "recMarketing"), recFinancial: opt(fd, "recFinancial"), recLegal: opt(fd, "recLegal"), recRisk: opt(fd, "recRisk") };
  const complete = Object.values(vals).every(Boolean);
  const [ap] = await db.update(schema.approvals).set({ ...vals, recSource: "mixed", recStatus: complete ? "ready" : "missing" }).where(eq(schema.approvals.id, id)).returning();
  await audit(u.email, "approval.recommendations.manual", "approval", id, ap.brandId, {});
  revalidatePath(`/approvals/${id}`);
}

export async function decideApproval(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "approvalId"));
  const decision = z.enum(["approved", "rejected"]).parse(str(fd, "decision"));
  const reason = str(fd, "reason");
  const [ap] = await db.select().from(schema.approvals).where(eq(schema.approvals.id, id));
  if (ap.status !== "pending") throw new Error("Already decided");
  if (decision === "rejected" && reason.length < 3) throw new Error("A rejection reason is required");
  if (decision === "approved" && ![ap.recMarketing, ap.recFinancial, ap.recLegal, ap.recRisk].every(Boolean)) {
    throw new Error("All four recommendations (Marketing, Financial, Legal, Risk) must be present before approval");
  }
  await db.update(schema.approvals).set({ status: decision, decisionReason: reason || null, decidedBy: u.email, decidedAt: new Date() }).where(eq(schema.approvals.id, id));
  if (ap.subjectType === "campaign" && ap.subjectId) {
    await db.update(schema.campaigns).set({ status: decision, updatedAt: new Date() }).where(eq(schema.campaigns.id, ap.subjectId));
  }
  if (ap.subjectType === "publication" && ap.subjectId) {
    await db.update(schema.contentItems).set({ status: decision === "approved" ? "approved" : "draft", updatedAt: new Date() }).where(eq(schema.contentItems.id, ap.subjectId));
  }
  await audit(u.email, `approval.${decision}`, "approval", id, ap.brandId, { reason, subjectType: ap.subjectType, subjectId: ap.subjectId, amount: ap.amount });
  revalidatePath("/approvals"); revalidatePath(`/approvals/${id}`);
}

export async function setCampaignStatus(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "campaignId"));
  const status = z.enum(["live", "paused", "completed"]).parse(str(fd, "status"));
  const [c] = await db.select().from(schema.campaigns).where(eq(schema.campaigns.id, id));
  const allowed: Record<string, string[]> = { approved: ["live"], live: ["paused", "completed"], paused: ["live", "completed"] };
  if (!allowed[c.status]?.includes(status)) throw new Error(`Cannot move from ${c.status} to ${status}`);
  await db.update(schema.campaigns).set({ status, updatedAt: new Date() }).where(eq(schema.campaigns.id, id));
  await audit(u.email, `campaign.${status}`, "campaign", id, c.brandId, { note: "Status recorded manually by CEO; no platform action taken by the system." });
  revalidatePath(`/campaigns/${id}`);
}

// ── Content ─────────────────────────────────────────────────────────
export async function saveContent(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "id")) || null;
  const values = {
    brandId: Number(str(fd, "brandId")), type: str(fd, "type"), channel: opt(fd, "channel"), language: str(fd, "language") || "en",
    title: z.string().min(2).max(300).parse(str(fd, "title")), body: str(fd, "body"),
    campaignId: Number(str(fd, "campaignId")) || null,
    scheduledFor: str(fd, "scheduledFor") ? new Date(str(fd, "scheduledFor")) : null,
    status: z.enum(["idea", "draft", "in_review"]).parse(str(fd, "status") || "draft"),
    updatedAt: new Date(),
  };
  if (id) {
    const [cur] = await db.select().from(schema.contentItems).where(eq(schema.contentItems.id, id));
    // Editing approved content sends it back for review.
    await db.update(schema.contentItems).set(values).where(eq(schema.contentItems.id, id));
    await audit(u.email, "content.update", "content", id, values.brandId, { previousStatus: cur.status });
  } else {
    const [c] = await db.insert(schema.contentItems).values(values).returning();
    await audit(u.email, "content.create", "content", c.id, values.brandId, {});
  }
  redirect("/content");
}

export async function generateContent(fd: FormData) {
  const u = await requireUser();
  const brandId = Number(str(fd, "brandId"));
  const type = str(fd, "type"), language = str(fd, "language") || "en", channel = str(fd, "channel");
  const agentSlug = ({ seo_article: "seo", email: "email-marketing", video_script: "video-producer", social_post: "social-media", ad: "creative-director" } as Record<string, string>)[type] ?? "content-writer";
  const langName = { en: "English", ar: "Arabic (native Gulf business register)", fr: "French" }[language] ?? "English";
  const [t] = await db.insert(schema.tasks).values({
    brandId, agentSlug, title: `Draft ${type.replace("_", " ")} (${language}) — ${str(fd, "topic").slice(0, 80)}`,
    brief: `Write a ${type.replace("_", " ")} for channel "${channel || "n/a"}" in ${langName}.\nTopic / angle: ${str(fd, "topic")}\nAudience: ${str(fd, "audience") || "the brand's target buyers"}\nOutput the final copy ready for review. Mark any claim needing proof with [VERIFY].`,
  }).returning();
  await audit(u.email, "content.generate", "task", t.id, brandId, { type, language });
  after(async () => {
    await runTask(t.id, u.email);
    const [d] = await db.select().from(schema.deliverables).where(eq(schema.deliverables.taskId, t.id));
    if (d) await db.insert(schema.contentItems).values({ brandId, type, channel: channel || null, language, title: t.title, body: d.body, status: "in_review", agentSlug, taskId: t.id });
  });
  revalidatePath("/content");
}

export async function requestPublication(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "contentId"));
  const [c] = await db.select().from(schema.contentItems).where(eq(schema.contentItems.id, id));
  const [ap] = await db.insert(schema.approvals).values({
    brandId: c.brandId, subjectType: "publication", subjectId: c.id, title: `Publish: ${c.title}`,
    description: `Type: ${c.type}\nChannel: ${c.channel ?? "-"}\nLanguage: ${c.language}\nScheduled: ${c.scheduledFor?.toISOString() ?? "not scheduled"}\n\n---\n${c.body}`,
  }).returning();
  await db.update(schema.contentItems).set({ status: "in_review", updatedAt: new Date() }).where(eq(schema.contentItems.id, id));
  await audit(u.email, "approval.request", "approval", ap.id, c.brandId, { contentId: id });
  after(() => generateApprovalRecommendations(ap.id));
  redirect(`/approvals/${ap.id}`);
}

export async function markContentPublished(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "contentId"));
  const url = z.string().url().parse(str(fd, "url"));
  const [c] = await db.select().from(schema.contentItems).where(eq(schema.contentItems.id, id));
  if (c.status !== "approved" && c.status !== "scheduled") throw new Error("Content must be approved first");
  await db.update(schema.contentItems).set({ status: "published", updatedAt: new Date() }).where(eq(schema.contentItems.id, id));
  await audit(u.email, "content.published.manual", "content", id, c.brandId, { url, note: "Published manually by the CEO; URL recorded as evidence." });
  revalidatePath("/content");
}

// ── Intelligence ────────────────────────────────────────────────────
export async function addResearch(fd: FormData) {
  const u = await requireUser();
  const brandId = Number(str(fd, "brandId"));
  const sourceUrl = opt(fd, "sourceUrl");
  let evidenceType = z.enum(["verified", "estimate", "assumption"]).parse(str(fd, "evidenceType"));
  if (evidenceType === "verified" && !sourceUrl) evidenceType = "estimate"; // verified requires a source
  const [r] = await db.insert(schema.researchItems).values({
    brandId, category: str(fd, "category") || "market", topic: str(fd, "topic"), finding: str(fd, "finding"),
    evidenceType, sourceUrl, sourceTitle: opt(fd, "sourceTitle"), agentSlug: null,
  }).returning();
  await audit(u.email, "research.add", "research", r.id, brandId, { evidenceType });
  revalidatePath("/intelligence");
}

// ── Metrics ─────────────────────────────────────────────────────────
export async function addMetric(fd: FormData) {
  const u = await requireUser();
  const brandId = Number(str(fd, "brandId"));
  const metric = str(fd, "metric");
  if (!(metric in METRICS)) throw new Error("Unknown metric");
  const value = z.coerce.number().finite().parse(str(fd, "value"));
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(str(fd, "date"));
  const note = z.string().min(3, "Source note required (e.g. invoice #, bank statement)").parse(str(fd, "note"));
  const [m] = await db.insert(schema.metricEntries).values({ brandId, date, metric, value: String(value), source: "manual", note, campaignId: Number(str(fd, "campaignId")) || null }).returning();
  await audit(u.email, "metric.add", "metric", m.id, brandId, { metric, value, date, note });
  revalidatePath("/metrics"); revalidatePath("/");
}

export async function deleteMetric(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "id"));
  const [m] = await db.delete(schema.metricEntries).where(and(eq(schema.metricEntries.id, id), eq(schema.metricEntries.source, "manual"))).returning();
  if (m) await audit(u.email, "metric.delete", "metric", id, m.brandId, { metric: m.metric, value: m.value, date: m.date });
  revalidatePath("/metrics");
}

// ── Integrations ────────────────────────────────────────────────────
export type ActionState = { ok?: string; error?: string } | null;

export async function testIntegration(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const key = str(fd, "provider");
  try {
    const msg = await testProvider(key);
    await audit(u.email, "integration.test.ok", "integration", key, null, {});
    return { ok: msg };
  } catch (e) {
    await audit(u.email, "integration.test.error", "integration", key, null, { error: String(e).slice(0, 300) });
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function syncIntegration(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const key = str(fd, "provider"), brandId = Number(str(fd, "brandId"));
  const days = Math.min(Math.max(Number(str(fd, "days")) || 30, 1), 365);
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  try {
    const n = await syncProvider(key, brandId, from, to);
    await audit(u.email, "integration.sync", "integration", key, brandId, { from, to, rows: n });
    return { ok: `Synced ${n} metric rows (${from} → ${to}).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Workflows ───────────────────────────────────────────────────────
export async function updateWorkflow(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "id"));
  const schedule = str(fd, "schedule");
  parseCron(schedule);
  const enabled = fd.get("enabled") === "on";
  const [w] = await db.update(schema.workflows).set({ schedule, enabled, brief: str(fd, "brief"), nextRunAt: enabled ? nextRun(schedule) : null }).where(eq(schema.workflows.id, id)).returning();
  await audit(u.email, enabled ? "workflow.enable" : "workflow.disable", "workflow", id, w.brandId, { schedule });
  revalidatePath("/workflows");
}

export async function runWorkflowNow(fd: FormData) {
  const u = await requireUser();
  const id = Number(str(fd, "id"));
  after(() => triggerWorkflow(id, u.email));
  revalidatePath("/workflows");
}

// ── Notifications ───────────────────────────────────────────────────
export async function markAllRead() {
  await requireUser();
  await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.read, false));
  revalidatePath("/", "layout");
}
