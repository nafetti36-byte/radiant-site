# Phase 1 — Research & Strategy

_Prepared 2026-11-16 by the CMO function. Evidence labels: **[V]** verified against a cited source, **[E]** estimate/derived, **[A]** assumption to test. Figures that sources disagree on are shown as ranges with each source._

## 1. What the business actually is (and what that means for marketing)

The only brand currently in scope is **Radiant Advising Services** (repo `radiant-site`): a Riyadh-based, commission-based **B2B industrial broker / trade consultant** for waste paper (OCC, SOP, SWL/HWS/LWS), virgin pulp, tissue jumbo rolls, packaging and HORECA consumables across Tunisia, the GCC, Europe and Africa.

**CMO challenge — parts of the brief do not fit this business:**

| Brief item | Fit for Radiant | Recommendation |
|---|---|---|
| Grow Instagram/TikTok followers | Low. Mill procurement managers do not buy containers of OCC from TikTok. | Do not invest beyond a maintained profile. Revisit only for a B2C brand. |
| Meta Ads | Low for brokerage; possible later for HORECA consumables. | Hold. |
| Shopify / checkout optimisation | Not applicable — there is no online store. The "checkout" is the **inquiry form and WhatsApp**. | Optimise the inquiry funnel instead. Shopify connector is built for future brands. |
| LinkedIn, SEO for trade queries, direct outreach, trade events, WhatsApp | High. This is where B2B buyers and suppliers are reachable. | Core channels for the first 90 days. |

**Critical issues found on the current website (must fix before any spend):**
1. Contact details are placeholders: `your@email.com`, `+966 000 000 000` (content/site-en.json). Every lead today is lost. **[V — repo file]**
2. Inquiry form depends on Netlify Forms; there is no confirmation of where submissions go or any CRM. **[V — repo]**
3. No analytics tag, no conversion tracking, no privacy notice — required before collecting EU or KSA personal data (GDPR; KSA PDPL). **[V — repo]**
4. "100% Focus on Trust & Compliance" is a vanity stat; replace with verifiable proof (deal count, tonnage handled, references) once the CEO can substantiate them. **[V — repo]**

## 2. Unit economics — why profit beats followers here

Commission model is 2.5% per the site. **[V — repo]** Illustrative account: 1,000 t/month of OCC at US$250/t **[A — both price and volume are assumptions]** → US$250,000 GMV → **US$6,250/month commission** per recurring account **[E]**. One retained mill relationship can justify thousands of dollars in acquisition cost, but sales cycles are long. KPIs must therefore be *qualified inquiries, verified counterparties and closed tonnage*, not reach.

Reference benchmarks for paid LinkedIn lead generation (not industrial-specific, methodologies differ):
- Paid LinkedIn average CPL ≈ **US$408** (Sopro 2025). **[V]** [sopro.io](https://sopro.io/resources/blog/b2b-cost-per-lead-benchmarks/)
- Metadata dataset (153 advertisers): cold prospecting ≈ **US$194**, retargeting ≈ US$234; document ads ≈ US$142. **[V]** [metadata.io](https://metadata.io/b2b-advertising-benchmarks)
- Manufacturing all-channel average CPL ≈ **US$553** (Cleverly citing Sopro). **[V]** [cleverly.co](https://www.cleverly.co/blog/linkedin-lead-generation-cost)

## 3. Target market evaluation

### Evidence collected

**Saudi Arabia (home base) — tissue capacity is expanding fast**
- MEPCO's Juthor ~60k t capacity, ~20% Saudi share; TM6 (US$92m, Andritz) to double to 120k t by 2026. **[V]** [papermart.in](https://papermart.in/mepcos-juthor-paper-manufacturing-co-plans/), [tissueworldmagazine.com](https://www.tissueworldmagazine.com/?p=28215)
- Saudi Paper Manufacturing 5th line (60k tpy) → 190k tpy total, completed Sept 2025. **[V]** [argaam.com](https://www.argaam.com/en/article/articledetail/id/1846173)
- Crown Paper Mill building a 60k tpa Saudi tissue mill (start dates conflict between sources). **[V]** [papermart.in](https://papermart.in/crown-paper-mill-first-uae-based-company-to-establish-60000-tpa-tissue-paper-mill-in-saudi-arabia/)
- Crown executives expect **oversupply** to persist as capacity outpaces demand growth. **[V — company statement via trade press]**
- Implication **[E]**: more machines = more demand for **virgin pulp and recovered fibre inputs**; selling *jumbo rolls into* KSA faces price pressure, while *exporting* KSA jumbo rolls to neighbouring markets may be the opportunity.

**India — the marginal global buyer of OCC**
- India consumes ~13.7 Mt/yr recovered fibre with ~32% imported (CESD study); a BIR presenter put the imported share at 60%. Sources conflict. **[V — both cited, definitions differ]** [wasterecyclingmag.com](https://www.wasterecyclingmag.com/news/india-s-recovered-fibre-sector-requires-reforms-to-reach-full-potential), [recyclingtoday.com](https://www.recyclingtoday.com/news/paper-pulp-recycling-trading-china-india-thailand-bir-meeting-2025)
- With China out of direct imports, India acts as the marginal buyer supporting OCC prices; Indian mills paid US$290–300/t for premium European mixed paper. **[V]** [fastmarkets.com](https://www.fastmarkets.com/insights/surging-demand-and-prices-in-india-boost-the-cost-of-recovered-paper-imports-in-sea/)
- Risks: Red Sea disruption, inconsistent import quality. **[V]** [printweek.in](https://www.printweek.in/news/geopolitics-driving-paper-prices-up-to-7-61886)

**Europe (supply side) and Southeast Asia**
- India and Southeast Asia absorb significant volumes of European OCC. **[V]** [thepulpandpapertimes.com](https://thepulpandpapertimes.com/news/global-recovered-paper-2294)
- Thailand, Malaysia, Indonesia are among the top importers of US recovered paper. **[V]** [recyclingtoday.com](https://www.recyclingtoday.com/news/rema-2025-more-recovered-paper-being-consumed-domestically-export-markets)
- EU rules will require non-OECD importing countries to obtain approval to import recovered paper by 2027 — a compliance cost for EU→India/SEA flows and a **service opportunity** for a documentation-strong broker. **[V]** [packaginginsights.com](https://www.packaginginsights.com/news/global-recovered-paper-market-china-policies-trade-us-tariffs-eu-regulatory-changes.html)

### Scoring (1–5; weights reflect a commission broker)

| Criterion (weight) | Saudi Arabia | India | EU (supply) | SE Asia | UAE |
|---|---|---|---|---|---|
| Demand evidence (25%) | 4 [V] | 5 [V] | n/a — supply | 4 [V] | 2 [A] |
| Radiant access/network (20%) | 5 [A] | 2 [A] | 3 [A] | 1 [A] | 4 [A] |
| Competition intensity, inverse (15%) | 3 [A] | 2 [A] | 3 [A] | 2 [A] | 3 [A] |
| Payment & counterparty risk, inverse (15%) | 4 [A] | 3 [A] | 4 [A] | 3 [A] | 4 [A] |
| Logistics fit (15%) | 4 [A] | 3 [E — Red Sea risk] | 4 [A] | 2 [A] | 4 [A] |
| Regulatory complexity, inverse (10%) | 4 [A] | 3 [V/E] | 2 [V — 2027 rule] | 3 [A] | 4 [A] |

Access and risk scores are CEO-knowledge assumptions; please correct them in the Control Center (Market Intelligence) — the ranking will be re-run by the Market Research agent once the API key is live.

### Recommendation — first three markets

1. **Saudi Arabia (demand: pulp & recovered fibre inputs to tissue mills; export of jumbo rolls).** Strongest combination of verified capacity growth and home-market access.
2. **India (demand: OCC and mixed paper).** Largest verified import demand; Radiant must build access — partner with an Indian agent rather than going direct.
3. **EU — Netherlands/Germany/Belgium/France as the supply side** (with Tunisia as a secondary source). A broker earns on matched flows; without reliable supply the two demand markets cannot be served. French-language capability is an advantage.

**Deferred:** SE Asia (strong demand, weak access — revisit in Q2), UAE (plausible, insufficient evidence gathered).

## 4. AI marketing tool landscape (what to use, what to skip)

_Assessed from product knowledge; prices change frequently and were not verified — confirm before purchase via an approval request._

| Need | Recommended now | Why | Skip / later |
|---|---|---|---|
| AI agents / copy / research | **Claude API** (built into the Control Center) | One engine, auditable, web search with citations | Separate AI-writer subscriptions |
| CRM & pipeline | **HubSpot (free→Starter)** or Pipedrive | B2B deal tracking, email sequences, forms | Salesforce (overkill) |
| Analytics | **GA4 + Search Console** (free) | Required for any attribution | Paid analytics suites |
| SEO research | Search Console first; Semrush/Ahrefs only if content program proves out | Avoid ~US$100+/mo tools before there is traffic **[E]** | |
| LinkedIn outreach | Sales Navigator (single seat) | Find mill procurement / supply-chain buyers | Automation bots that violate LinkedIn ToS |
| WhatsApp | WhatsApp Business (app now, API later) | Dominant B2B channel in GCC/North Africa **[A]** | |
| Email | HubSpot or Brevo | Consent management for GDPR/PDPL | |

## 5. Automation opportunities (built into the platform)

Daily market scan, competitor monitoring, weekly content drafts, performance analysis, segmentation, lead-qualification rules, SEO audit, weekly recommendations, weekly strategy review, monthly financial report — all defined as scheduled workflows (disabled until you enable them and deploy).
