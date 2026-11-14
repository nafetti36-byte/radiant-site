-- Hanen 360 v2 — core schema.
-- Additive only: every table is new and prefixed `h360_`. No existing table is
-- altered or dropped, so records of the previous application are preserved.
-- Back up first:  npx wrangler d1 export <db> --remote --output backups/pre-0001.sql

CREATE TABLE IF NOT EXISTS h360_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','director','analyst','viewer')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  mfa_secret TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  lang TEXT NOT NULL DEFAULT 'fr',
  legacy_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS h360_sessions (
  id_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES h360_users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  mfa_pending INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS h360_sessions_user ON h360_sessions(user_id);

CREATE TABLE IF NOT EXISTS h360_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  success INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS h360_login_attempts_key ON h360_login_attempts(key, created_at);

CREATE TABLE IF NOT EXISTS h360_password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES h360_users(id) ON DELETE CASCADE,
  created_by INTEGER,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS h360_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  scopes TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS h360_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS h360_audit_created ON h360_audit_log(created_at);

CREATE TABLE IF NOT EXISTS h360_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER
);

-- ───────── Purchasing ─────────
CREATE TABLE IF NOT EXISTS h360_suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country TEXT,
  categories TEXT NOT NULL DEFAULT '',          -- comma list: virgin_pulp,recovered
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  payment_terms_days INTEGER,
  incoterm TEXT,
  quality_rating REAL,                           -- 1..5 from quality validation
  reliability_rating REAL,                       -- 1..5 delivery reliability
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS h360_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES h360_suppliers(id),
  category TEXT NOT NULL CHECK (category IN ('virgin_pulp','recovered')),
  grade TEXT NOT NULL,                           -- NBSK, BEKP, BHKP, SWL, HWS, SOP, ...
  offer_date TEXT NOT NULL,
  valid_until TEXT,
  price REAL NOT NULL,                           -- nominal price per tonne in `currency`
  currency TEXT NOT NULL DEFAULT 'TND',
  incoterm TEXT,
  quantity_t REAL,
  freight_tnd_t REAL NOT NULL DEFAULT 0,
  customs_pct REAL NOT NULL DEFAULT 0,           -- % of nominal value
  handling_tnd_t REAL NOT NULL DEFAULT 0,
  processing_tnd_t REAL NOT NULL DEFAULT 0,      -- pulping, sorting, deinking labour/ops
  energy_extra_tnd_t REAL NOT NULL DEFAULT 0,    -- incremental energy vs reference fibre
  chemicals_extra_tnd_t REAL NOT NULL DEFAULT 0, -- deinking/bleaching chemicals
  other_tnd_t REAL NOT NULL DEFAULT 0,
  moisture_pct REAL NOT NULL DEFAULT 10,
  contamination_pct REAL NOT NULL DEFAULT 0,     -- prohibitives, plastics, outthrows
  process_loss_pct REAL NOT NULL DEFAULT 0,      -- sorting + deinking + fibre losses
  payment_terms_days INTEGER,
  brightness_iso REAL,
  quality_status TEXT NOT NULL DEFAULT 'not_tested' CHECK (quality_status IN ('not_tested','pending','approved','rejected')),
  quality_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending_validation','active','negotiating','accepted','rejected','expired')),
  ceiling_exception INTEGER NOT NULL DEFAULT 0,  -- director-authorised exception to VP cap
  ceiling_exception_by INTEGER,
  ceiling_exception_note TEXT,
  negotiated_price REAL,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  validation_status TEXT NOT NULL DEFAULT 'validated' CHECK (validation_status IN ('pending','validated','rejected')),
  validated_by INTEGER,
  validated_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS h360_offers_grade ON h360_offers(grade, status);
CREATE INDEX IF NOT EXISTS h360_offers_supplier ON h360_offers(supplier_id);

CREATE TABLE IF NOT EXISTS h360_negotiations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL REFERENCES h360_offers(id),
  event_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('note','counter_offer','supplier_reply','decision')),
  price REAL,
  note TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS h360_market_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade TEXT NOT NULL,
  price_date TEXT NOT NULL,
  price REAL NOT NULL,
  currency TEXT NOT NULL,
  basis TEXT,                                    -- e.g. CIF Rades, list, net
  source TEXT NOT NULL,                          -- publisher / feed / supplier name
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','import','feed')),
  validation_status TEXT NOT NULL DEFAULT 'validated' CHECK (validation_status IN ('pending','validated','rejected')),
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS h360_market_grade ON h360_market_prices(grade, price_date);

CREATE TABLE IF NOT EXISTS h360_fx_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT NOT NULL,                        -- EUR, USD...
  rate_tnd REAL NOT NULL,                        -- TND per 1 unit of currency
  rate_date TEXT NOT NULL,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','import','feed')),
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER
);
CREATE INDEX IF NOT EXISTS h360_fx_cur ON h360_fx_rates(currency, rate_date);

-- ───────── Production & costing ─────────
CREATE TABLE IF NOT EXISTS h360_production_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  machine TEXT NOT NULL CHECK (machine IN ('PM1','PM2')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  product_grade TEXT NOT NULL,
  gross_t REAL NOT NULL DEFAULT 0,
  saleable_t REAL NOT NULL,
  rejects_t REAL NOT NULL DEFAULT 0,
  downtime_h REAL NOT NULL DEFAULT 0,
  available_h REAL,
  vp_t REAL NOT NULL DEFAULT 0,
  vp_cost_tnd REAL NOT NULL DEFAULT 0,
  recovered_t REAL NOT NULL DEFAULT 0,
  recovered_cost_tnd REAL NOT NULL DEFAULT 0,
  electricity_kwh REAL NOT NULL DEFAULT 0,
  electricity_tariff REAL NOT NULL DEFAULT 0,    -- TND/kWh
  gas_nm3 REAL NOT NULL DEFAULT 0,
  gas_tariff REAL NOT NULL DEFAULT 0,            -- TND/Nm3
  steam_t REAL NOT NULL DEFAULT 0,
  steam_cost_tnd_t REAL NOT NULL DEFAULT 0,
  cogen_allocation_tnd REAL NOT NULL DEFAULT 0,  -- share of cogeneration cost (negative = credit)
  water_m3 REAL NOT NULL DEFAULT 0,
  water_tariff REAL NOT NULL DEFAULT 0,
  chemicals_tnd REAL NOT NULL DEFAULT 0,
  packaging_tnd REAL NOT NULL DEFAULT 0,
  labour_tnd REAL NOT NULL DEFAULT 0,
  maintenance_tnd REAL NOT NULL DEFAULT 0,
  fixed_overhead_tnd REAL NOT NULL DEFAULT 0,
  variable_overhead_tnd REAL NOT NULL DEFAULT 0,
  freight_selling_tnd REAL NOT NULL DEFAULT 0,
  avg_selling_price_tnd_t REAL,
  closing_stock_t REAL NOT NULL DEFAULT 0,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  validation_status TEXT NOT NULL DEFAULT 'validated' CHECK (validation_status IN ('pending','validated','rejected')),
  computed_json TEXT,                             -- cached result of the costing engine
  computed_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS h360_prod_machine ON h360_production_periods(machine, period_end);

CREATE TABLE IF NOT EXISTS h360_price_simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  machine TEXT,
  product_grade TEXT,
  base_period_id INTEGER,
  inputs_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────── Decisions, savings, alerts ─────────
CREATE TABLE IF NOT EXISTS h360_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT UNIQUE,
  module TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  reasoning TEXT,
  inputs_json TEXT,                               -- verified input records (refs)
  calc_json TEXT,                                 -- formulae & numbers
  savings_tnd REAL,
  risks TEXT,
  data_freshness TEXT,
  confidence REAL,
  missing_info TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','more_analysis','superseded')),
  created_by TEXT NOT NULL,                       -- engine | agent:<id> | user:<id>
  decided_by INTEGER,
  decided_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS h360_reco_status ON h360_recommendations(status);

CREATE TABLE IF NOT EXISTS h360_savings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,                         -- fibre, energy, chemicals, yield, logistics, other
  description TEXT,
  baseline_tnd REAL,
  projected_tnd REAL NOT NULL DEFAULT 0,
  realized_tnd REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified','validated','in_progress','realized','rejected')),
  owner TEXT,
  due_date TEXT,
  recommendation_id INTEGER,
  quality_validated INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS h360_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT UNIQUE,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  acknowledged_by INTEGER,
  acknowledged_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────── Automation ─────────
CREATE TABLE IF NOT EXISTS h360_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  agent TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')),
  triggered_by TEXT NOT NULL,
  input_json TEXT,
  output_json TEXT,
  error TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS h360_jobs_status ON h360_jobs(status, started_at);

CREATE TABLE IF NOT EXISTS h360_connectors (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured','connected','error','disabled')),
  config_json TEXT,
  last_check_at TEXT,
  last_ok_at TEXT,
  detail TEXT
);

CREATE TABLE IF NOT EXISTS h360_import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  filename TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('staged','committed','rejected')),
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_valid INTEGER NOT NULL DEFAULT 0,
  rows_json TEXT NOT NULL,                        -- staged rows with per-row errors
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  committed_by INTEGER,
  committed_at TEXT
);

CREATE TABLE IF NOT EXISTS h360_inbound_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK (channel IN ('email','pdf_upload')),
  sender TEXT,
  subject TEXT,
  filename TEXT,
  sha256 TEXT,
  body_text TEXT,
  extracted_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','extracted','converted','rejected')),
  offer_id INTEGER,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER
);

CREATE TABLE IF NOT EXISTS h360_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('daily','weekly','adhoc')),
  period_label TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ───────── Hanen AI ─────────
CREATE TABLE IF NOT EXISTS h360_ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  agent TEXT NOT NULL DEFAULT 'director',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS h360_ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES h360_ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content_json TEXT NOT NULL,                     -- Anthropic content blocks (kept verbatim)
  display_text TEXT,
  tools_used TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS h360_ai_msg_conv ON h360_ai_messages(conversation_id, id);

INSERT OR IGNORE INTO h360_connectors (id, enabled, status, detail) VALUES
  ('ai', 0, 'not_configured', 'Secret ANTHROPIC_API_KEY requis'),
  ('fx', 0, 'not_configured', 'Activer et tester la source de taux de change'),
  ('pulp_feed', 0, 'not_configured', 'Flux de prix pâte sous licence requis (PULP_FEED_URL)'),
  ('email', 0, 'not_configured', 'Cloudflare Email Routing vers ce Worker requis'),
  ('notify', 0, 'not_configured', 'Secret NOTIFY_WEBHOOK_URL requis'),
  ('erp', 0, 'not_configured', 'Clé API d''ingestion ou import CSV/Excel');
