import { and, eq, lte, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { nextRun } from "./cron.ts";
import { runTask } from "./ai.ts";
import { audit } from "./audit.ts";
import { DEFAULT_WORKFLOWS } from "./agents.ts";

export async function ensureDefaultWorkflows(brandId: number) {
  const existing = await db.select({ key: schema.workflows.key }).from(schema.workflows).where(eq(schema.workflows.brandId, brandId));
  const have = new Set(existing.map((w) => w.key));
  const missing = DEFAULT_WORKFLOWS.filter((w) => !have.has(w.key));
  if (missing.length) await db.insert(schema.workflows).values(missing.map((w) => ({ ...w, brandId, enabled: false })));
}

/** Start one workflow run: creates a task for the agent and executes it. */
export async function triggerWorkflow(workflowId: number, actor: string) {
  const [wf] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, workflowId));
  if (!wf) throw new Error("Workflow not found");
  const now = new Date();
  const [task] = await db.insert(schema.tasks).values({
    brandId: wf.brandId, agentSlug: wf.agentSlug, title: `${wf.name} — ${now.toISOString().slice(0, 10)}`,
    brief: wf.brief, source: "workflow", workflowId: wf.id,
  }).returning();
  const [run] = await db.insert(schema.workflowRuns).values({ workflowId: wf.id, taskId: task.id, status: "started" }).returning();
  await db.update(schema.workflows).set({ lastRunAt: now, nextRunAt: wf.enabled ? nextRun(wf.schedule, now) : null }).where(eq(schema.workflows.id, wf.id));
  await audit(actor, "workflow.run", "workflow", wf.id, wf.brandId, { taskId: task.id });
  await runTask(task.id, actor);
  const [t] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
  const ok = t.status === "needs_review";
  await db.update(schema.workflowRuns).set({
    status: ok ? "completed" : t.status === "awaiting_credentials" ? "skipped" : "failed",
    message: t.error ?? null, finishedAt: new Date(),
  }).where(eq(schema.workflowRuns.id, run.id));
  return t;
}

/** Called by /api/cron. Runs every enabled workflow whose next_run_at has passed. */
export async function runDueWorkflows(now = new Date(), limit = 5) {
  const due = await db.select().from(schema.workflows)
    .where(and(eq(schema.workflows.enabled, true), isNotNull(schema.workflows.nextRunAt), lte(schema.workflows.nextRunAt, now)))
    .limit(limit);
  const results = [];
  for (const wf of due) {
    try {
      const t = await triggerWorkflow(wf.id, "scheduler");
      results.push({ workflow: wf.key, brandId: wf.brandId, task: t.id, status: t.status });
    } catch (e) {
      results.push({ workflow: wf.key, brandId: wf.brandId, error: String(e) });
    }
  }
  return results;
}
