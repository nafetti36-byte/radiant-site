import { db, schema } from "@/db/client.ts";
import { replaceSourceMetrics, type MetricKey } from "../metrics.ts";
import { googleAccessToken } from "./google-auth.ts";

export type SyncRow = { date: string; metric: MetricKey; value: number };
export type Provider = {
  key: string;
  name: string;
  category: "Commerce" | "Analytics" | "Search" | "Social & Ads" | "Email & CRM" | "AI";
  implemented: "sync" | "test-only" | "planned";
  envVars: string[];
  permissions: string[];
  setup: string[];
  metrics?: MetricKey[];
  test?: () => Promise<string>;
  sync?: (from: string, to: string) => Promise<SyncRow[]>;
};

const env = (k: string) => process.env[k]?.trim() || "";
async function jsonOrThrow(res: Response, label: string) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${label} ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body as any;
}

// ── Shopify Admin GraphQL ────────────────────────────────────────────
const SHOPIFY_API = "2025-10";
async function shopifyGql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(`https://${env("SHOPIFY_STORE_DOMAIN")}/admin/api/${SHOPIFY_API}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopify-Access-Token": env("SHOPIFY_ADMIN_TOKEN") },
    body: JSON.stringify({ query, variables }),
  });
  const j = await jsonOrThrow(res, "Shopify");
  if (j.errors) throw new Error(`Shopify: ${JSON.stringify(j.errors).slice(0, 300)}`);
  return j.data;
}

// ── GA4 Data API ─────────────────────────────────────────────────────
async function ga4Report(from: string, to: string) {
  const token = await googleAccessToken("https://www.googleapis.com/auth/analytics.readonly");
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env("GA4_PROPERTY_ID")}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      dateRanges: [{ startDate: from, endDate: to }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "keyEvents" }],
    }),
  });
  return jsonOrThrow(res, "GA4");
}

// ── Meta Marketing API ───────────────────────────────────────────────
const META_V = "v23.0";
async function metaGet(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, access_token: env("META_ACCESS_TOKEN") });
  return jsonOrThrow(await fetch(`https://graph.facebook.com/${META_V}/${path}?${qs}`), "Meta");
}

export const PROVIDERS: Provider[] = [
  {
    key: "anthropic", name: "Claude API (agent engine)", category: "AI", implemented: "test-only",
    envVars: ["ANTHROPIC_API_KEY"],
    permissions: ["An Anthropic API key from console.anthropic.com (workspace with a spend limit you choose)."],
    setup: ["Create a key in the Anthropic Console", "Set a monthly spend limit on the workspace", "Add ANTHROPIC_API_KEY to the server environment"],
    test: async () => {
      const { callClaude } = await import("../ai.ts");
      const r = await callClaude("Reply with the single word OK.", "ping", { effort: "low" });
      return `Responded via ${r.model}: "${r.text.slice(0, 20)}"`;
    },
  },
  {
    key: "shopify", name: "Shopify", category: "Commerce", implemented: "sync",
    envVars: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN"],
    permissions: ["Custom app (Settings → Apps → Develop apps) with Admin API scopes: read_orders, read_customers, read_products.", "read_all_orders is only needed for orders older than 60 days."],
    setup: ["Create a custom app in Shopify admin", "Grant the scopes above and install", "Copy the Admin API access token (shown once)"],
    metrics: ["revenue", "conversions", "new_customers"],
    test: async () => { const d = await shopifyGql("{ shop { name currencyCode } }"); return `Connected to ${d.shop.name} (${d.shop.currencyCode})`; },
    sync: async (from, to) => {
      const byDay = new Map<string, { rev: number; orders: number; newCust: number }>();
      let cursor: string | null = null;
      for (let page = 0; page < 40; page++) {
        const d: any = await shopifyGql(
          `query($q:String!,$after:String){ orders(first:100, after:$after, query:$q){ pageInfo{hasNextPage endCursor}
            nodes{ createdAt test cancelledAt currentTotalPriceSet{shopMoney{amount}} customer{ numberOfOrders } } } }`,
          { q: `created_at:>=${from} created_at:<=${to}T23:59:59Z`, after: cursor });
        for (const o of d.orders.nodes) {
          if (o.test || o.cancelledAt) continue;
          const day = o.createdAt.slice(0, 10);
          const e = byDay.get(day) ?? { rev: 0, orders: 0, newCust: 0 };
          e.rev += Number(o.currentTotalPriceSet.shopMoney.amount); e.orders += 1;
          if (o.customer && Number(o.customer.numberOfOrders) === 1) e.newCust += 1;
          byDay.set(day, e);
        }
        if (!d.orders.pageInfo.hasNextPage) break;
        cursor = d.orders.pageInfo.endCursor;
      }
      return [...byDay].flatMap(([date, e]) => [
        { date, metric: "revenue" as const, value: e.rev },
        { date, metric: "conversions" as const, value: e.orders },
        { date, metric: "new_customers" as const, value: e.newCust },
      ]);
    },
  },
  {
    key: "ga4", name: "Google Analytics 4", category: "Analytics", implemented: "sync",
    envVars: ["GA4_PROPERTY_ID", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_KEY"],
    permissions: ["Google Cloud service account with the Google Analytics Data API enabled.", "Add the service-account email as a Viewer on the GA4 property (Admin → Property access management)."],
    setup: ["Create a GCP project and enable 'Google Analytics Data API'", "Create a service account + JSON key", "Grant Viewer on the GA4 property", "Set GA4_PROPERTY_ID (numeric) and the key env vars"],
    metrics: ["sessions", "leads"],
    test: async () => { const r = await ga4Report("7daysAgo", "today"); return `GA4 OK — ${r.rowCount ?? 0} day rows in the last 7 days`; },
    sync: async (from, to) => {
      const r = await ga4Report(from, to);
      return (r.rows ?? []).flatMap((row: any) => {
        const d = row.dimensionValues[0].value as string;
        const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
        return [
          { date, metric: "sessions" as const, value: Number(row.metricValues[0].value) },
          // GA4 key events (e.g. inquiry form submit) are recorded as leads.
          { date, metric: "leads" as const, value: Number(row.metricValues[1].value) },
        ];
      });
    },
  },
  {
    key: "gsc", name: "Google Search Console", category: "Search", implemented: "test-only",
    envVars: ["GSC_SITE_URL", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_KEY"],
    permissions: ["Enable the Search Console API in the same GCP project.", "Add the service-account email as a (Restricted) user on the Search Console property."],
    setup: ["Verify the domain in Search Console", "Add the service account as a user", "Set GSC_SITE_URL (e.g. sc-domain:example.com)"],
    test: async () => {
      const token = await googleAccessToken("https://www.googleapis.com/auth/webmasters.readonly");
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
      const r = await jsonOrThrow(await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(env("GSC_SITE_URL"))}/searchAnalytics/query`, {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ startDate: from, endDate: to, dimensions: ["query"], rowLimit: 5 }),
      }), "GSC");
      return `GSC OK — top queries: ${(r.rows ?? []).map((x: any) => x.keys[0]).join(", ") || "none yet"}`;
    },
  },
  {
    key: "meta", name: "Meta Business (Facebook & Instagram Ads)", category: "Social & Ads", implemented: "sync",
    envVars: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
    permissions: ["Business Manager system user with access to the ad account.", "Token permissions: ads_read (reporting). ads_management only if you later approve automated publishing.", "Instagram publishing additionally needs instagram_basic + instagram_content_publish and a linked Instagram professional account."],
    setup: ["Business Settings → System users → Add", "Assign the ad account (and Page/IG account if publishing)", "Generate a token with the permissions above", "Set META_AD_ACCOUNT_ID as act_<id>"],
    metrics: ["ad_spend", "attributed_revenue"],
    test: async () => { const r = await metaGet(env("META_AD_ACCOUNT_ID"), { fields: "name,currency,account_status" }); return `Meta OK — ${r.name} (${r.currency})`; },
    sync: async (from, to) => {
      const r = await metaGet(`${env("META_AD_ACCOUNT_ID")}/insights`, {
        fields: "spend,action_values", time_increment: "1", level: "account",
        time_range: JSON.stringify({ since: from, until: to }), limit: "500",
      });
      return (r.data ?? []).flatMap((row: any) => {
        const purchase = (row.action_values ?? []).find((a: any) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase");
        const out: SyncRow[] = [{ date: row.date_start, metric: "ad_spend", value: Number(row.spend) }];
        if (purchase) out.push({ date: row.date_start, metric: "attributed_revenue", value: Number(purchase.value) });
        return out;
      });
    },
  },
  {
    key: "google_ads", name: "Google Ads", category: "Social & Ads", implemented: "planned",
    envVars: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_OAUTH_CLIENT_ID", "GOOGLE_ADS_OAUTH_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN"],
    permissions: ["Google Ads API developer token (apply in the Manager account API Center; Basic access needed for production).", "OAuth consent for scope https://www.googleapis.com/auth/adwords by a user with access to the account."],
    setup: ["Create a Manager (MCC) account", "Apply for a developer token", "Create OAuth client and obtain a refresh token"],
  },
  {
    key: "tiktok", name: "TikTok for Business", category: "Social & Ads", implemented: "planned",
    envVars: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID"],
    permissions: ["TikTok Marketing API app approval; scopes for Ads Management read (reporting)."],
    setup: ["Register a developer app at business-api.tiktok.com", "Authorize the advertiser account"],
  },
  {
    key: "linkedin", name: "LinkedIn (Page & Campaign Manager)", category: "Social & Ads", implemented: "planned",
    envVars: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_ORG_ID", "LINKEDIN_AD_ACCOUNT_ID"],
    permissions: ["LinkedIn developer app with Marketing Developer Platform / Advertising API access (application required).", "Scopes: r_ads_reporting, r_organization_social; w_organization_social only for approved publishing."],
    setup: ["Create app linked to the company Page", "Request Advertising API access", "OAuth as a Page admin"],
  },
  {
    key: "email_platform", name: "Email platform (Brevo / Mailchimp / Klaviyo)", category: "Email & CRM", implemented: "planned",
    envVars: ["EMAIL_PROVIDER", "EMAIL_API_KEY"],
    permissions: ["API key with campaigns:read and lists:read. Sending scope only after approval workflow for sends is enabled."],
    setup: ["Choose provider", "Create a restricted API key"],
  },
  {
    key: "crm", name: "CRM (HubSpot / Pipedrive / Zoho)", category: "Email & CRM", implemented: "planned",
    envVars: ["CRM_PROVIDER", "CRM_TOKEN"],
    permissions: ["Private-app token with read access to contacts, companies and deals (HubSpot: crm.objects.contacts.read, crm.objects.deals.read)."],
    setup: ["Choose CRM", "Create a private app / API token with read scopes"],
  },
];

export function providerStatus(p: Provider): "connected-config" | "awaiting-credentials" | "planned" {
  if (p.implemented === "planned") return "planned";
  return p.envVars.every((v) => env(v)) ? "connected-config" : "awaiting-credentials";
}

export async function testProvider(key: string) {
  const p = PROVIDERS.find((x) => x.key === key);
  if (!p?.test) throw new Error("No test available");
  if (providerStatus(p) !== "connected-config") throw new Error("Missing credentials: " + p.envVars.filter((v) => !env(v)).join(", "));
  try {
    const msg = await p.test();
    await db.insert(schema.integrationRuns).values({ provider: key, kind: "test", status: "ok", message: msg });
    return msg;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.insert(schema.integrationRuns).values({ provider: key, kind: "test", status: "error", message: msg.slice(0, 1000) });
    throw e;
  }
}

export async function syncProvider(key: string, brandId: number, from: string, to: string) {
  const p = PROVIDERS.find((x) => x.key === key);
  if (!p?.sync) throw new Error("Sync not implemented for this provider");
  if (providerStatus(p) !== "connected-config") throw new Error("Missing credentials");
  try {
    const rows = await p.sync(from, to);
    await replaceSourceMetrics(brandId, key, from, to, rows);
    await db.insert(schema.integrationRuns).values({ provider: key, brandId, kind: "sync", status: "ok", records: rows.length, message: `${from}..${to}` });
    return rows.length;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.insert(schema.integrationRuns).values({ provider: key, brandId, kind: "sync", status: "error", message: msg.slice(0, 1000) });
    throw e;
  }
}
