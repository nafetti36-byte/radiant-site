import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { AGENT_BY_SLUG, type AgentDef } from "./agents.ts";
import { audit, notify } from "./audit.ts";
import { deriveKpis, metricTotals, rangeLastDays } from "./metrics.ts";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const HOUSE_RULES = `NON-NEGOTIABLE RULES
- Never fabricate data, sales, customers, testimonials, certifications, results or completed actions.
- Every number must either come from the DATA section below, from a web source you actually retrieved (cite URL), or be explicitly labelled ESTIMATE or ASSUMPTION with your reasoning.
- If the data you need is missing, say exactly what is missing and how to obtain it. Do not fill gaps with invented figures.
- You draft and recommend only. You cannot publish, send, spend or change any account. Anything external needs CEO approval.
- Respect advertising law, privacy (GDPR, KSA PDPL, UAE PDPL) and platform policies. Flag risks.
- Prioritise profit and qualified pipeline over vanity metrics. Challenge weak ideas.
- Be concise, structured (Markdown headings and bullets), and commercially specific.`;

type Brand = typeof schema.brands.$inferSelect;

async function dataContext(brand: Brand) {
  const r30 = rangeLastDays(30);
  const totals = await metricTotals(brand.id, r30.from, r30.to);
  const k = deriveKpis(totals);
  const { _sources, ...vals } = totals;
  const research = await db.select().from(schema.researchItems)
    .where(eq(schema.researchItems.brandId, brand.id)).orderBy(desc(schema.researchItems.createdAt)).limit(15);
  const camps = await db.select().from(schema.campaigns).where(eq(schema.campaigns.brandId, brand.id)).orderBy(desc(schema.campaigns.updatedAt)).limit(10);
  return `DATA (from the Control Center database — the only internal data you may treat as fact)
Recorded metrics, last 30 days (${r30.from}..${r30.to}): ${Object.keys(vals).length ? JSON.stringify(vals) : "NONE RECORDED"}
Metric sources: ${JSON.stringify(_sources)}
Derived KPIs (null = insufficient data): ${JSON.stringify(k)}
Campaigns: ${camps.length ? camps.map((c) => `#${c.id} ${c.name} [${c.status}] ${c.channel} ${c.market ?? ""} budget ${c.budget} ${c.currency}`).join("; ") : "none"}
Recent research findings:
${research.length ? research.map((r) => `- (${r.evidenceType}) ${r.topic}: ${r.finding}${r.sourceUrl ? ` [${r.sourceUrl}]` : ""}`).join("\n") : "- none"}`;
}

function systemPrompt(agent: AgentDef, brand: Brand) {
  return `You are the ${agent.name} in an AI marketing department working for the CEO of ${brand.name}.
Mission: ${agent.mission}
Responsibilities: ${agent.responsibilities.join("; ")}
KPIs you are judged on: ${agent.kpis.join("; ")}
Standard operating procedure:
${agent.sop.map((s) => `- ${s}`).join("\n")}

BRAND
Name: ${brand.name}
Website: ${brand.website ?? "n/a"}
Industry: ${brand.industry ?? "n/a"}
Description: ${brand.description ?? "n/a"}
Target markets: ${brand.markets.join(", ") || "n/a"}
Languages: ${brand.languages.join(", ")}
Voice: ${brand.voice ?? "professional, factual"}

${HOUSE_RULES}`;
}

const RESEARCH_SUFFIX = `

After your report, output a fenced code block tagged \`findings\` containing a JSON array of the key findings:
[{"category":"market|competitor|keyword|trend|customer|regulation","topic":"...","finding":"...","evidence_type":"verified|estimate|assumption","source_url":"https://... or null","source_title":"..."}]
Use "verified" ONLY when the finding is directly supported by a page you retrieved in this session and give its URL.`;

type RunResult = { text: string; sources: { url: string; title: string }[]; inputTokens: number; outputTokens: number; model: string };

/** One Claude call (with server-side web search when allowed), resuming on pause_turn. */
export async function callClaude(system: string, user: string, opts: { webSearch?: boolean; effort?: "low" | "medium" | "high" } = {}): Promise<RunResult> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: user }];
  const sources = new Map<string, string>();
  let text = "", inputTokens = 0, outputTokens = 0, model = MODEL();
  for (let i = 0; i < 4; i++) {
    const stream = client.beta.messages.stream({
      model: MODEL(),
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: opts.effort ?? "medium" },
      system,
      messages,
      ...(opts.webSearch ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }] } : {}),
    });
    const msg = await stream.finalMessage();
    inputTokens += msg.usage.input_tokens; outputTokens += msg.usage.output_tokens; model = msg.model;
    for (const block of msg.content) {
      if (block.type === "text") text += block.text;
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === "web_search_result") sources.set(r.url, r.title);
      }
    }
    if (msg.stop_reason === "refusal") throw new Error(`Model declined the request (${msg.stop_details?.category ?? "unspecified"}).`);
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
  }
  return { text: text.trim(), sources: [...sources].map(([url, title]) => ({ url, title })), inputTokens, outputTokens, model };
}

function extractFindings(text: string) {
  const m = text.match(/```findings\s*([\s\S]*?)```/);
  if (!m) return { body: text, findings: [] as any[] };
  let findings: any[] = [];
  try { findings = JSON.parse(m[1]); } catch { /* ignore malformed */ }
  return { body: text.replace(m[0], "").trim(), findings: Array.isArray(findings) ? findings : [] };
}

/**
 * Execute a queued task. Sets status, stores the deliverable and any research
 * findings, and writes an audit trail. If no API key, marks awaiting_credentials.
 */
export async function runTask(taskId: number, actor = "system") {
  const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
  if (!task) throw new Error("Task not found");
  const agent = AGENT_BY_SLUG[task.agentSlug];
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, task.brandId));
  const setStatus = (status: string, error: string | null = null) =>
    db.update(schema.tasks).set({ status, error, updatedAt: new Date() }).where(eq(schema.tasks.id, taskId));

  if (!aiConfigured()) {
    await setStatus("awaiting_credentials", "ANTHROPIC_API_KEY is not configured — task not executed.");
    return;
  }
  await setStatus("running");
  await audit(actor, "task.run.start", "task", taskId, task.brandId, { agent: task.agentSlug });
  try {
    const isResearch = agent.outputType === "research" || agent.webResearch;
    const user = `${await dataContext(brand)}

TASK: ${task.title}
${task.brief}${isResearch ? RESEARCH_SUFFIX : ""}`;
    const res = await callClaude(systemPrompt(agent, brand), user, { webSearch: agent.webResearch });
    const { body, findings } = extractFindings(res.text);
    const retrieved = new Set(res.sources.map((s) => s.url));
    await db.insert(schema.deliverables).values({
      taskId, brandId: task.brandId, agentSlug: task.agentSlug, title: task.title, body,
      model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens, sources: res.sources,
    });
    for (const f of findings.slice(0, 30)) {
      if (!f?.finding || !f?.topic) continue;
      // Downgrade "verified" if the URL was not actually retrieved in this run.
      let evidence = ["verified", "estimate", "assumption"].includes(f.evidence_type) ? f.evidence_type : "assumption";
      if (evidence === "verified" && !(f.source_url && retrieved.has(f.source_url))) evidence = "estimate";
      await db.insert(schema.researchItems).values({
        brandId: task.brandId, agentSlug: task.agentSlug, taskId, category: String(f.category ?? "market"),
        topic: String(f.topic).slice(0, 300), finding: String(f.finding).slice(0, 4000), evidenceType: evidence,
        sourceUrl: f.source_url || null, sourceTitle: f.source_title || null,
      });
    }
    await setStatus("needs_review");
    await audit(actor, "task.run.complete", "task", taskId, task.brandId, { model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens, findings: findings.length, sources: res.sources.length });
    await notify(task.brandId, `${agent.name} delivered: ${task.title}`, "Ready for your review.", `/agents/${task.agentSlug}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await setStatus("failed", msg.slice(0, 1000));
    await audit(actor, "task.run.failed", "task", taskId, task.brandId, { error: msg.slice(0, 500) });
  }
}

/** Generate the four approval-board recommendations for an approval request. */
export async function generateApprovalRecommendations(approvalId: number) {
  const [ap] = await db.select().from(schema.approvals).where(eq(schema.approvals.id, approvalId));
  if (!ap) return;
  if (!aiConfigured()) {
    await db.update(schema.approvals).set({ recStatus: "missing" }).where(eq(schema.approvals.id, approvalId));
    return;
  }
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, ap.brandId));
  await db.update(schema.approvals).set({ recStatus: "generating" }).where(eq(schema.approvals.id, approvalId));
  const ctx = await dataContext(brand);
  const request = `APPROVAL REQUEST #${ap.id} (${ap.subjectType})
Title: ${ap.title}
Amount: ${ap.amount ?? "n/a"} ${ap.currency ?? ""}
Details:
${ap.description}

Write your recommendation for the CEO. Structure: **Recommendation: APPROVE / APPROVE WITH CONDITIONS / REJECT**, then rationale, key numbers (labelled verified/estimate/assumption), conditions, and what would change your mind. Max 250 words.`;
  const roles: [keyof typeof cols, string][] = [["recMarketing", "cmo"], ["recFinancial", "finance"], ["recLegal", "legal"], ["recRisk", "risk"]];
  const cols = { recMarketing: "", recFinancial: "", recLegal: "", recRisk: "" };
  try {
    const results = await Promise.all(roles.map(([, slug]) =>
      callClaude(systemPrompt(AGENT_BY_SLUG[slug], brand), `${ctx}\n\n${request}`, { effort: "medium", webSearch: slug === "legal" })));
    roles.forEach(([col], i) => { cols[col] = results[i].text; });
    await db.update(schema.approvals).set({ ...cols, recSource: "ai", recStatus: "ready" }).where(eq(schema.approvals.id, approvalId));
    await audit("system", "approval.recommendations.generated", "approval", approvalId, ap.brandId, {
      tokens: results.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    });
  } catch (e) {
    await db.update(schema.approvals).set({ recStatus: "failed" }).where(eq(schema.approvals.id, approvalId));
    await audit("system", "approval.recommendations.failed", "approval", approvalId, ap.brandId, { error: String(e).slice(0, 500) });
  }
}

export async function tasksByAgent(brandId: number, slug: string) {
  return db.select().from(schema.tasks).where(and(eq(schema.tasks.brandId, brandId), eq(schema.tasks.agentSlug, slug))).orderBy(desc(schema.tasks.createdAt)).limit(50);
}
