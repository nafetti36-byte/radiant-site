# Hanen 360 v2: industrial intelligence for Azur Papier

Hanen 360 is a Cloudflare Worker with a D1 database and a mobile-first web app. Hanen Mosbah, Director of Operations, uses it to reduce the **true cost per sellable tonne of Jumbo Roll**, negotiate fibre prices from facts, and decide on selling prices.

> The interface is in French by default, with Arabic (RTL) and English. All business data comes from Azur Papier's own records. The application contains **no demo prices, suppliers or production figures**.

---

## 0. Live deployment (Netlify)

**https://hanen-360.netlify.app**, Netlify site `hanen-360`.

- Static app in `public/`. The API runs as the Netlify Function `api` (`/api/*`), with the scheduled functions `cron-daily` (05:00 UTC) and `cron-weekly` (Monday 06:00 UTC).
- Database: the same SQL schema, run by SQLite (sql.js) behind a D1-compatible facade (`src/netlify/`). The file is persisted in **Netlify Blobs** (store `hanen360`). Writes are conditional on the etag; on conflict the request is replayed.
- Site environment variables: `SETUP_TOKEN` (delete it after creating the first administrator), `AWS_LAMBDA_JS_RUNTIME=nodejs22.x`, `AI_MODEL`. To enable Hanen AI, add `ANTHROPIC_API_KEY`. Optional: `NOTIFY_WEBHOOK_URL`, `PULP_FEED_URL`, `PULP_FEED_TOKEN`.
- Redeploy: `node scripts/build-netlify.mjs && npx netlify-cli deploy --prod --dir public --functions netlify/functions`.
- Back up the data: download the blob `hanen360.sqlite` (Netlify API `GET /api/v1/blobs/{site_id}/site:hanen360/hanen360.sqlite`). It is a standard SQLite file.
- Tests on this runtime: `E2E_TARGET=netlify npm run test:e2e` (121/121).
- Netlify limits: synchronous functions time out after ~10 s on the free plan (26 s on paid plans), and a Hanen AI answer that chains several tools can exceed that. Email ingestion (Cloudflare Email Routing) is not available on Netlify; upload quotation PDFs under *Documents entrants* instead.
- The Cloudflare Worker deployment (sections 3 and 4) remains supported by the same code.

---

## 0b. Automatic calculations (minimal data entry)

- **Live calculation while typing** (`public/js/live.js`) in the offer form, the production period form, the price simulation and the ceiling calculator. The browser runs `public/js/engine.js`, compiled by `scripts/build-engine.mjs` from the **same** files as the server (`src/engine/fibre.ts`, `costing.ts`), so a preview always equals the saved result (an e2e test checks this).
- **Smart pre-fill** (never overwrites a field already typed in):
  - Offer: the supplier's last offer for the same grade (freight, processing, moisture, contamination, losses, payment terms, currency). Shows the change vs the previous price. The category follows the grade.
  - Production: next period (the day after the last one → end of month), grade, tariffs (electricity, gas, steam, water), average fibre prices, fixed costs. **Consumption figures (kWh, Nm³, tonnes) are never estimated.**
  - Totals: tonnes × price/t = fibre cost; gross − saleable = rejects.
- **Automatic analysis after every save** (offers, prices, FX, production, imports, validations): recommendations and alerts update without clicking "Analyser" (job `auto_scan`).
- **Quick entry** on the dashboard, plus one-tap activation of automatic exchange rates (admin).

## 1. What is in this release

| Module | What it does |
|---|---|
| **Tableau de Direction** | KPIs (cost/t PM1/PM2, negotiation potential, realized savings, pending decisions, alerts), "where each dinar goes" breakdown, cost trend, market, alerts, and a **guided setup** while the database is empty |
| **Hanen AI** | Claude-based economic and financial adviser with 15 specialist agents, each limited to its own read-only tools. It answers in FR/AR/EN, every answer is grounded in tool calls on validated records, and its recommendations enter the approval workflow |
| **Achats & Fournisseurs** | Supplier CRM, offers, negotiation log, quality validation, director exception to the price cap, comparison/ranking, PDF and email quotations (drafts that require validation) |
| **Pâte vierge** | Market price history with source, trend, landed cost, live virgin pulp (VP) offers, trend reading |
| **Papiers recyclés** | SWL/HWS/SOP buying ceilings, cost per usable tonne of fibre, ceiling calculator, rankings |
| **Production PM1 & PM2** | Costing by period and grade, line-by-line breakdown, ratios, sensitivity, variance vs the previous period |
| **Énergie** | kWh/t, steam t/t, gas, water, energy cost/t, gap to the best period recorded |
| **Prix Jumbo Roll** | Cost-to-sell simulation: floor price (variable cost), break-even, target price, margin at current/proposed/competitor price, saved simulations |
| **Économies** | Savings register: identified → validated → in progress → realized, compared with the annual target |
| **Administration** | Users and roles, connections, FX, schedules and job log, imports, business parameters, API keys, audit log, existing (legacy) data, backup |
| **Rapports** | Daily and weekly reports (automatic), downloadable as **PDF** and **Excel** |

### Core formulas (`src/engine/fibre.ts`, `src/engine/costing.ts`)

```
usable_yield     = (1 − moisture) × (1 − contamination) × (1 − process losses)
landed (TND/t)   = price × FX × (1 + customs %) + freight + handling
financing        = price × FX × cost_of_capital × (stock_days − payment_days) / 365
effective (TND per usable t) = (landed + processing + incremental energy + chemicals + other + financing) / usable_yield

Recovered ceiling P_max = (VP_effective × quality_equivalence × yield − fixed costs) / (FX × (1 + customs + financing factor))
Business rule:   ceiling = min(P_max, comparable VP nominal price), unless a director authorises an exception (justification is logged)
Target           = min(ceiling × (1 − negotiation margin), best competitor at equal effective cost, offer price)
Expected savings = (offer − target) × FX × quantity
```

A substitution is never approved automatically. Every recovered offer shows **"Validation qualité requise"** until quality has approved it.

### Roles

| Role | Rights |
|---|---|
| `viewer` | Read only |
| `analyst` | Create, import and validate data; run analyses; use Hanen AI |
| `director` | Everything an analyst can do, plus approve/reject recommendations, authorise exceptions to the price cap, and edit business parameters |
| `admin` | Everything, plus users, connections, API keys, audit log and backup |

### Security

- Passwords are hashed with PBKDF2-SHA256 at 100,000 iterations (the WebCrypto maximum on Workers), with a 16-byte salt.
- Policy: at least 12 characters and 3 character classes.
- Sessions are stored in D1. The cookie is `__Host-`, `HttpOnly`, `Secure`, `SameSite=Strict`, and lasts 12 h.
- CSRF protection: a per-session token is sent in the `X-CSRF-Token` header, and the `Origin` header is checked.
- Rate limiting: 5 failures per account+IP, 20 per IP, then 15 minutes of blocking. Setup, MFA and password reset are rate-limited too.
- Optional TOTP MFA (RFC 6238). Password recovery uses a one-time link (1 h) issued by the administrator.
- Temporary passwords must be changed at first login.
- All input is validated on the server. The audit log records every write, decision, export and login.
- Security headers: CSP, `frame-ancestors 'none'`, HSTS. No secret is stored in the code.
- The first administrator is activated with a one-time `SETUP_TOKEN` secret. The admin screen shows a warning for as long as that secret still exists.

---

## 2. Live vs. needs configuration

| Capability | Status after deployment |
|---|---|
| Login, roles, MFA, audit, CRUD, imports, calculations, recommendations, approvals, reports, exports, cron | **Works with no further configuration** |
| Hanen AI chat, specialist agents, PDF/email extraction | **Connexion requise** until `ANTHROPIC_API_KEY` is set. The rule-based engine keeps working without it |
| Automatic FX | Disabled by default. The admin enables it and clicks **Tester**. Source: open.er-api.com, free and keyless. For accounting, enter the **BCT fixing** manually or import it |
| Pulp market prices (NBSK/BEKP…) | **Connexion requise**: needs a licensed feed (e.g. Fastmarkets RISI, TTO) via `PULP_FEED_URL`/`PULP_FEED_TOKEN`. Until then, prices are entered or imported **with their source**. No price is ever invented |
| Supplier email quotations | Configure Cloudflare **Email Routing** → "Send to Worker" `hanen-360`, plus the authorised domains under Paramètres |
| Notifications | Teams/Slack incoming webhook in `NOTIFY_WEBHOOK_URL`, then enable and test |
| ERP / production PM1-PM2 / energy meters | Excel/CSV import, or push to `POST /api/ingest/{type}` with a scoped API key. Batches stay **pending validation** |

---

## 3. Deploying onto the existing `hanen-360` (with backup and rollback)

The existing Worker source and database are not in this repository. **Do not lose existing data.** Migration `0001` is **additive only**: every table is new and prefixed `h360_`. Existing tables are neither modified nor dropped, and they show up read-only under *Administration → Données existantes*.

```bash
cd hanen-360
npm ci
npx wrangler login                       # Cloudflare account that owns hanen-360
npx wrangler d1 list                     # copy the existing database's id and name
#   → edit wrangler.toml: database_name and database_id (binding "DB")

# 1. Preflight + FULL BACKUP (mandatory)
./scripts/preflight.sh <db-name>
./scripts/backup.sh <db-name>            # backups/<db>-<timestamp>.sql, keep it outside git

# 2. (recommended) Staging test on a COPY of the data
npx wrangler d1 create hanen-360-staging
npx wrangler d1 execute hanen-360-staging --remote --file backups/<file>.sql
#   temporarily point wrangler.toml at the copy, then:
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy --name hanen-360-staging   # test at hanen-360-staging.<account>.workers.dev

# 3. Production
npm run db:migrate:remote                # creates the h360_* tables
openssl rand -base64 32 | npx wrangler secret put SETUP_TOKEN   # NEW token, never the old shared one
npx wrangler secret put ANTHROPIC_API_KEY                        # optional (Hanen AI)
npx wrangler deploy
#   → open https://hanen-360.nafetti36.workers.dev, create the administrator with SETUP_TOKEN
npx wrangler secret delete SETUP_TOKEN   # immediately after activation
```

**Rotating exposed credentials.** The activation secret previously shared in public is no longer used: the new code accepts only the new `SETUP_TOKEN`, and only while no account exists. Also rotate any API key or password that appeared in the old code or in messages. Old users can be migrated under *Données existantes* (a reset link is required; old password hashes are not reused).

**Rollback**

- Code: `npx wrangler rollback` returns to the previous Worker version. The old application still finds its own tables untouched.
- Data: `npx wrangler d1 time-travel restore <db> --timestamp=<ISO8601>` (up to 30 days), or reimport the SQL backup.
- Remove v2 tables only (destructive, only after a backup): `DROP TABLE` each `h360_*` table.

---

## 4. Integrations

**Licensed pulp feed** (`PULP_FEED_URL`, optionally `PULP_FEED_TOKEN` as a Bearer token). Expected JSON:
```json
{ "prices": [ { "grade": "BEKP", "date": "2026-11-01", "price": 699, "currency": "USD", "basis": "CIF", "source": "Publisher" } ] }
```

**Ingestion API** (ERP, PM1/PM2 supervision, energy meters):
```bash
curl -X POST https://hanen-360.nafetti36.workers.dev/api/ingest/production \
  -H "Authorization: Bearer h360_xxx" -H "Content-Type: application/json" \
  -d '{"rows":[{"machine":"PM1","period_start":"2026-11-01","period_end":"2026-11-07","product_grade":"2x17","saleable_t":240,"electricity_kwh":210000}]}'
```
Accepted types: `production`, `offers`, `market_prices`, `fx_rates`, `suppliers`. Columns follow the Excel templates (*Importer → Modèle Excel*). French headers are recognised ("Tonnage vendable", "Coût pâte vierge", "Tarif électricité"…). Unrecognised columns are flagged explicitly and are never silently imported.

**Cron** (UTC): `0 5 * * *` runs FX (if enabled), the pulp feed (if enabled), cost recalculation, the engine scan (recommendations and alerts), supplier ranking and the daily report. `0 6 * * 1` runs the weekly report and its notification. Every step is a job in *Administration → Automatisation*. An agent only shows as **active** while its job has `running` status.

---

## 5. Tests

```bash
npm run typecheck      # TypeScript strict
npm run test:unit      # 25 tests: formulas checked by hand, CSV/XLSX/PDF, TOTP RFC 6238, validation
npm run test:e2e       # 121 checks against real workerd + local D1 (auth, CSRF, roles, engines, imports,
                       #   cron, reports, AI tool loop through a local Anthropic API mock, MFA, legacy preservation)
npm run test:ui        # 120 checks with Playwright: iPhone 14 (FR + AR/RTL) and desktop, no horizontal
                       #   overflow, no JS errors, touch targets ≥ 40 px, full-screen forms, workflows
```
The AI tests use a **local mock** of the Anthropic API (`tests/e2e/mocks.mjs`), which checks the request format, the tool loop, permissions and persistence. They do not check the quality of real answers, which needs a real key.

---

## 6. Known limitations

- PDF reports are rendered in Latin script (FR/EN). For Arabic, use the Excel export.
- Email ingestion reads the body text. Attached PDFs are not parsed automatically; upload them under *Documents entrants*.
- The default FX source is not the BCT fixing. For accounting, enter the BCT fixing (marked as source "BCT").
- The data limits (quality equivalence, default VP logistics, cost of capital, margins) are **editable assumptions** under Paramètres. The defaults must be set by management.
- Workers PBKDF2 is capped at 100,000 iterations. Optional MFA is recommended for directors and admins.
- An AI answer can take 10 to 60 s, because it runs several tool calls.
