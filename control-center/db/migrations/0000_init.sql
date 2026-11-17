CREATE TABLE "approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" integer,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(14, 2),
	"currency" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"rec_marketing" text,
	"rec_financial" text,
	"rec_legal" text,
	"rec_risk" text,
	"rec_source" text DEFAULT 'manual' NOT NULL,
	"rec_status" text DEFAULT 'missing' NOT NULL,
	"decision_reason" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"brand_id" integer,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website" text,
	"industry" text,
	"description" text,
	"markets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"languages" jsonb DEFAULT '["en"]'::jsonb NOT NULL,
	"voice" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"name" text NOT NULL,
	"objective" text NOT NULL,
	"channel" text NOT NULL,
	"market" text,
	"language" text DEFAULT 'en' NOT NULL,
	"budget" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"start_date" date,
	"end_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"kpi_target" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"campaign_id" integer,
	"type" text NOT NULL,
	"channel" text,
	"language" text DEFAULT 'en' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"agent_slug" text,
	"task_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"brand_id" integer NOT NULL,
	"agent_slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"brand_id" integer,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"records" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"date" date NOT NULL,
	"source" text NOT NULL,
	"metric" text NOT NULL,
	"value" numeric(16, 4) NOT NULL,
	"campaign_id" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"agent_slug" text,
	"task_id" integer,
	"category" text DEFAULT 'market' NOT NULL,
	"topic" text NOT NULL,
	"finding" text NOT NULL,
	"evidence_type" text NOT NULL,
	"source_url" text,
	"source_title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"agent_slug" text NOT NULL,
	"title" text NOT NULL,
	"brief" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"workflow_id" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_id" integer NOT NULL,
	"task_id" integer,
	"status" text NOT NULL,
	"message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"agent_slug" text NOT NULL,
	"schedule" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"brief" text NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_entries" ADD CONSTRAINT "metric_entries_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_entries" ADD CONSTRAINT "metric_entries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_items" ADD CONSTRAINT "research_items_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "metrics_brand_date_idx" ON "metric_entries" USING btree ("brand_id","date");--> statement-breakpoint
CREATE INDEX "tasks_brand_agent_idx" ON "tasks" USING btree ("brand_id","agent_slug");