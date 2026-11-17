# Phase 4 — Integrations & the permissions you must provide

Status as of this build — **no external account is connected yet**. Nothing below has been tested against a live account because no credentials were provided.

| Integration | Code status | What you need to give me | Data it brings |
|---|---|---|---|
| Claude API (agent engine) | Built, connection test | Anthropic API key (set a workspace spend limit) | Makes the 21 roles execute |
| Google Analytics 4 | Built: test + daily metric sync | GCP service account; add its email as **Viewer** on the GA4 property; property ID | sessions, key events → leads |
| Google Search Console | Built: connection test | Same service account added as user on the property | Queries (SEO agent) |
| Shopify | Built: test + sync | Custom app token with `read_orders`, `read_customers`, `read_products` | revenue, orders, new customers — **only for future e-commerce brands** |
| Meta Marketing API | Built: test + spend sync | System-user token with `ads_read` (`ads_management` only if publishing is later approved); ad account ID | ad spend, purchase value |
| Google Ads | Planned | Developer token (Basic access), OAuth client, refresh token with `adwords` scope | spend, conversions |
| LinkedIn | Planned (priority for Radiant) | Developer app with Advertising API access: `r_ads_reporting`, `r_organization_social` | spend, leads |
| TikTok | Planned (low priority) | Marketing API app + advertiser authorisation | spend |
| Email platform | Planned | Restricted API key (read) | sends, clicks |
| CRM (HubSpot/Pipedrive) | Planned (priority) | Private-app token with read on contacts/companies/deals | leads, deals, revenue attribution |

## Security model
- Credentials live only in server environment variables; never in the DB, never sent to the browser.
- Read-only scopes first. Write scopes (publishing, budgets) only after you approve automated execution as a separate decision.
- Every test/sync is logged in `integration_runs` and the audit log.

## Highest-value next step for Radiant
1. Fix website contact details and add GA4 with a key event on inquiry submit.
2. Set up HubSpot free CRM and route the inquiry form to it.
3. Provide the Anthropic key so the research and content agents start working.
