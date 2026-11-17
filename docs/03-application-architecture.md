# Phase 3 — AI Marketing Control Center (v0.1)

Source: `control-center/`. Stack: **Next.js 16 (App Router, server actions) · TypeScript · PostgreSQL 16 · Drizzle ORM · Claude API (`@anthropic-ai/sdk`) · jose (JWT sessions) · bcrypt**.

```
Browser ──► proxy.ts (session check) ──► Server components / server actions ──► PostgreSQL
                                                │
                                                ├─► lib/ai.ts ──► Claude API (role prompt + DB context + web search)
                                                ├─► lib/integrations ──► Shopify / GA4 / GSC / Meta (read-only)
Vercel Cron ──► /api/cron (Bearer CRON_SECRET) ─┴─► lib/workflows.ts ──► due workflows → tasks → agents
```

## Modules
| Module | Route | Notes |
|---|---|---|
| CEO Dashboard | `/` | 12 KPIs computed only from `metric_entries`; empty = "No data recorded" |
| AI Marketing Team | `/agents`, `/agents/[slug]` | Per-agent workspace: responsibilities, SOP, tasks, deliverables, sources, research, approvals, execution history |
| Campaign Manager | `/campaigns` | draft → pending approval → approved/rejected → live → paused/completed |
| Approvals | `/approvals` | 4 recommendations required; APPROVE locked otherwise; reject needs reason |
| Content Studio | `/content` | AI or manual drafts EN/AR/FR; publication approval; record live URL |
| Calendar | `/calendar` | Campaign spans + scheduled content |
| Market Intelligence | `/intelligence` | Verified / estimate / assumption, filters; auto-downgrade of unverifiable claims |
| Data & Metrics | `/metrics` | Manual entries need an evidence note; integration rows are source-tagged |
| Integrations | `/integrations` | Honest status, required permissions, test/sync buttons |
| Automations | `/workflows` | 10 scheduled workflows (disabled by default), cron editor, run log |
| Executive Report | `/reports` | The 8-section report, generated from records only |
| Audit Log | `/audit` | Every action, decision, run |
| Brands | `/brands` | Multi-brand profiles that agents receive as context |

## Security
Single administrator (bcrypt hash in env), HS256 session cookie (httpOnly, sameSite=lax, secure in prod, 12h), login throttle, all mutations re-check the session server-side, security headers, cron endpoint uses constant-time bearer comparison, integration credentials server-side only.

## Tested
- `npm test`: cron scheduling, KPI math (nulls when data missing), agent/workflow integrity — 6/6 pass.
- Browser end-to-end (Playwright, against Postgres): bad login rejected; login; empty dashboard shows no fabricated numbers; all 15 pages load; agent task without API key → "awaiting credentials"; campaign → approval; APPROVE locked until 4 recommendations; decision recorded; ROAS 3.00× / CAC $200 computed from entered rows; Arabic RTL; audit entries present — 11/11 pass.
- **Not tested** (no credentials provided): live Claude calls, Shopify/GA4/GSC/Meta API calls, deployed cron.

## Known limitations (v0.1)
- Single admin user; integration credentials are global (shared by all brands) — per-brand encrypted credentials planned.
- UI navigation/KPIs are translated to AR/FR; page body text is mostly English. Generated content is fully EN/AR/FR.
- No automated publishing to platforms (by design until you approve write scopes).
- Login throttle is in-memory per instance; add a WAF/rate limit in production.
