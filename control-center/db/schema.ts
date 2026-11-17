import {
  pgTable, serial, text, integer, boolean, timestamp, numeric, jsonb, date, index,
} from "drizzle-orm/pg-core";

export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  website: text("website"),
  industry: text("industry"),
  description: text("description"),
  markets: jsonb("markets").$type<string[]>().notNull().default([]),
  languages: jsonb("languages").$type<string[]>().notNull().default(["en"]),
  voice: text("voice"),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  agentSlug: text("agent_slug").notNull(),
  title: text("title").notNull(),
  brief: text("brief").notNull(),
  // queued | running | awaiting_credentials | needs_review | done | failed | cancelled
  status: text("status").notNull().default("queued"),
  priority: text("priority").notNull().default("normal"),
  source: text("source").notNull().default("manual"), // manual | workflow
  workflowId: integer("workflow_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("tasks_brand_agent_idx").on(t.brandId, t.agentSlug)]);

export const deliverables = pgTable("deliverables", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  brandId: integer("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  agentSlug: text("agent_slug").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  sources: jsonb("sources").$type<{ url: string; title: string }[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  objective: text("objective").notNull(),
  channel: text("channel").notNull(),
  market: text("market"),
  language: text("language").notNull().default("en"),
  budget: numeric("budget", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  // draft | pending_approval | approved | rejected | live | paused | completed
  status: text("status").notNull().default("draft"),
  kpiTarget: text("kpi_target"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  subjectType: text("subject_type").notNull(), // campaign | spend | publication | change
  subjectId: integer("subject_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  currency: text("currency"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  recMarketing: text("rec_marketing"),
  recFinancial: text("rec_financial"),
  recLegal: text("rec_legal"),
  recRisk: text("rec_risk"),
  recSource: text("rec_source").notNull().default("manual"), // ai | manual | mixed
  recStatus: text("rec_status").notNull().default("missing"), // missing | generating | ready | failed
  decisionReason: text("decision_reason"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  type: text("type").notNull(), // social_post | ad | email | web_copy | video_script | seo_article | product_description
  channel: text("channel"),
  language: text("language").notNull().default("en"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  // idea | draft | in_review | approved | scheduled | published
  status: text("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  agentSlug: text("agent_slug"),
  taskId: integer("task_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const researchItems = pgTable("research_items", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  agentSlug: text("agent_slug"),
  taskId: integer("task_id"),
  category: text("category").notNull().default("market"), // market | competitor | keyword | trend | customer | regulation
  topic: text("topic").notNull(),
  finding: text("finding").notNull(),
  evidenceType: text("evidence_type").notNull(), // verified | estimate | assumption
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metricEntries = pgTable("metric_entries", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  source: text("source").notNull(), // manual | shopify | ga4 | meta_ads | google_ads | gsc
  metric: text("metric").notNull(),
  value: numeric("value", { precision: 16, scale: 4 }).notNull(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("metrics_brand_date_idx").on(t.brandId, t.date)]);

export const integrationRuns = pgTable("integration_runs", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  brandId: integer("brand_id"),
  kind: text("kind").notNull(), // test | sync
  status: text("status").notNull(), // ok | error
  message: text("message"),
  records: integer("records").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  name: text("name").notNull(),
  agentSlug: text("agent_slug").notNull(),
  schedule: text("schedule").notNull(), // 5-field cron, UTC
  enabled: boolean("enabled").notNull().default(false),
  brief: text("brief").notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflowRuns = pgTable("workflow_runs", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  taskId: integer("task_id"),
  status: text("status").notNull(), // started | completed | failed | skipped
  message: text("message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  brandId: integer("brand_id"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
