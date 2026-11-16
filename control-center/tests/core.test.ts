import { test } from "node:test";
import assert from "node:assert/strict";
import { nextRun, parseCron } from "../lib/cron.ts";
import { deriveKpis } from "../lib/metrics-math.ts";
import { AGENTS, DEFAULT_WORKFLOWS, AGENT_BY_SLUG } from "../lib/agents.ts";

test("cron: daily at 05:00 UTC", () => {
  assert.equal(nextRun("0 5 * * *", new Date("2026-11-16T04:59:30Z")).toISOString(), "2026-11-16T05:00:00.000Z");
  assert.equal(nextRun("0 5 * * *", new Date("2026-11-16T05:00:00Z")).toISOString(), "2026-11-17T05:00:00.000Z");
});
test("cron: weekdays list and monthly", () => {
  // 2026-11-16 is a Monday
  assert.equal(nextRun("0 6 * * 1,4", new Date("2026-11-16T07:00:00Z")).toISOString(), "2026-11-19T06:00:00.000Z");
  assert.equal(nextRun("0 6 1 * *", new Date("2026-11-16T00:00:00Z")).toISOString(), "2026-12-01T06:00:00.000Z");
  assert.equal(nextRun("*/15 * * * *", new Date("2026-11-16T10:07:00Z")).toISOString(), "2026-11-16T10:15:00.000Z");
});
test("cron: rejects invalid", () => {
  assert.throws(() => parseCron("61 * * * *"));
  assert.throws(() => parseCron("* * *"));
});
test("kpis: null when inputs missing (no guessing)", () => {
  const k = deriveKpis({ _sources: {} });
  assert.deepEqual(k, { marketingSpend: null, netOperatingProfit: null, conversionRate: null, cac: null, roas: null });
});
test("kpis: computed from recorded totals", () => {
  const k = deriveKpis({ _sources: {}, ad_spend: 400, other_marketing_cost: 100, attributed_revenue: 1200, new_customers: 5, sessions: 1000, conversions: 20, gross_profit: 2000, operating_expenses: 300 });
  assert.equal(k.marketingSpend, 500);
  assert.equal(k.cac, 100);
  assert.equal(k.roas, 3);
  assert.equal(k.conversionRate, 0.02);
  assert.equal(k.netOperatingProfit, 1200);
});
test("agents: 20 specialists + risk board, workflows reference real agents", () => {
  assert.equal(AGENTS.length, 21);
  assert.equal(AGENTS.filter((a) => a.slug !== "risk").length, 20);
  for (const w of DEFAULT_WORKFLOWS) assert.ok(AGENT_BY_SLUG[w.agentSlug], w.key);
});
