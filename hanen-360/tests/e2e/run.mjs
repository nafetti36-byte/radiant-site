// End-to-end functional, integration and authorisation tests against a real local
// Workers runtime (wrangler dev / workerd) with a real local D1 database.
//   npm run test:e2e
import { spawn, execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { startAnthropicMock, startFxMock, anthropicLog } from './mocks.mjs';

const PORT = 8799, BASE = `http://127.0.0.1:${PORT}`;
const SETUP_TOKEN = 'e2e-' + crypto.randomBytes(8).toString('hex');
let passed = 0, failed = 0;
const results = [];
function ok(cond, name, extra) {
  if (cond) { passed++; results.push(`  ✓ ${name}`); }
  else { failed++; results.push(`  ✗ ${name}${extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 400) : ''}`); }
}

class Client {
  constructor() { this.cookie = ''; this.csrf = null; }
  async req(method, path, body, { form, headers = {}, raw } = {}) {
    const h = { ...headers };
    if (this.cookie) h.Cookie = this.cookie;
    if (this.csrf && method !== 'GET') h['X-CSRF-Token'] = this.csrf;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const r = await fetch(BASE + path, { method, headers: h, body: payload });
    const sc = r.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    if (raw) return r;
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
  }
  get(p) { return this.req('GET', p); }
  post(p, b, o) { return this.req('POST', p, b, o); }
  put(p, b) { return this.req('PUT', p, b); }
  del(p) { return this.req('DELETE', p); }
  async login(email, password) {
    const r = await this.post('/api/auth/login', { email, password });
    if (r.status === 200) this.csrf = r.data.csrf;
    return r;
  }
}

function totp(secretB32, t = Date.now()) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, val = 0; const out = [];
  for (const c of secretB32) { val = (val << 5) | A.indexOf(c); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const mac = crypto.createHmac('sha1', Buffer.from(out)).update(buf).digest();
  const o = mac[mac.length - 1] & 15;
  return String(((mac.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}

async function waitFor(url, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { const r = await fetch(url); if (r.ok) return; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  throw new Error('server did not start');
}

const sh = (cmd) => execSync(cmd, { stdio: 'pipe', cwd: process.cwd() }).toString();

async function main() {
  const NETLIFY = process.env.E2E_TARGET === 'netlify';
  const LEGACY_SQL = "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, full_name TEXT, password TEXT); INSERT INTO users (email, full_name, password) VALUES ('hanen.mosbah@azur-papier.example','Hanen Mosbah','legacy-hash'),('controle@azur-papier.example','Contrôle Gestion','legacy-hash2');";
  const testEnv = { SETUP_TOKEN, ANTHROPIC_API_KEY: 'test-key-not-real', ANTHROPIC_BASE_URL: 'http://127.0.0.1:8790', FX_API_BASE: 'http://127.0.0.1:8791', AI_KEY_ENCRYPTION_KEY: 'q0d0uP2X9k3m4n5b6v7c8x9z0a1s2d3f4g5h6j7k8l8=' };
  let legacyBefore, dev;
  const legacyRows = async () => NETLIFY ? JSON.stringify(await (await fetch(`${BASE}/__test/legacy`)).json()) : JSON.stringify(JSON.parse(sh(`npx wrangler d1 execute DB --local --json --command "SELECT * FROM users ORDER BY id"`))[0].results);
  if (NETLIFY) {
    results.push('Target: Netlify runtime (Functions handler + D1 facade on sql.js + Blobs store)');
    sh('npx esbuild tests/e2e/netlify-local-entry.ts --bundle --platform=node --format=esm --log-level=error --outfile=tests/e2e/.netlify-local.mjs --banner:js="import { createRequire as __cr } from \'module\'; const require = __cr(import.meta.url);"');
  } else {
    // ── Fresh local D1 with a simulated pre-existing (legacy) application table
    rmSync('.wrangler/state', { recursive: true, force: true });
    writeFileSync('.dev.vars', Object.entries(testEnv).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
    sh(`npx wrangler d1 execute DB --local --command "${LEGACY_SQL}"`);
    legacyBefore = await legacyRows();
    sh('npx wrangler d1 migrations apply DB --local');
  }

  const ai = await startAnthropicMock(8790);
  const fx = await startFxMock(8791);
  dev = NETLIFY
    ? spawn('node', ['tests/e2e/.netlify-local.mjs'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, ...testEnv, PORT: String(PORT), SEED_LEGACY: LEGACY_SQL } })
    : spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--test-scheduled'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let devLog = ''; dev.stdout.on('data', (d) => (devLog += d)); dev.stderr.on('data', (d) => (devLog += d));
  try {
    await waitFor(`${BASE}/api/health`);
    if (NETLIFY) legacyBefore = await legacyRows();
    await suite();
    ok(legacyBefore === await legacyRows() && legacyBefore.includes('legacy-hash'), 'legacy table rows are untouched after migration and full test run');
  } catch (e) {
    failed++; results.push(`  ✗ suite crashed: ${e.stack}`);
    console.log(devLog.slice(-4000));
  } finally {
    try { process.kill(-dev.pid, 'SIGTERM'); } catch { dev.kill('SIGTERM'); } ai.close(); fx.close();
    if (!NETLIFY) writeFileSync('.dev.vars', 'SETUP_TOKEN=local-test-setup-token\n');
  }
  console.log(results.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

async function suite() {
  const admin = new Client();
  const anon = new Client();
  results.push('Phase 1 — authentication & security');
  let r = await anon.get('/api/auth/status');
  ok(r.data.setup_required && r.data.setup_token_configured, 'fresh install requires setup');
  ok((await anon.get('/api/dashboard')).status === 401, 'API rejects unauthenticated access');
  ok((await anon.post('/api/auth/setup', { token: 'wrong', email: 'a@b.tn', password: 'Azur-Papier-2026!' })).status === 403, 'setup rejects a wrong activation token');
  ok((await anon.post('/api/auth/setup', { token: SETUP_TOKEN, email: 'admin@azur-papier.example', password: 'short' })).status === 422, 'setup enforces password policy');
  r = await anon.post('/api/auth/setup', { token: SETUP_TOKEN, name: 'Admin IT', email: 'admin@azur-papier.example', password: 'Azur-Papier-Admin-2026' });
  ok(r.status === 200, 'first administrator created with the one-time token', r.data);
  ok((await anon.post('/api/auth/setup', { token: SETUP_TOKEN, email: 'x@y.tn', password: 'Azur-Papier-Admin-2026' })).status === 409, 'setup cannot be replayed once a user exists');
  ok((await admin.login('admin@azur-papier.example', 'nope')).status === 401, 'wrong password rejected');
  r = await admin.login('admin@azur-papier.example', 'Azur-Papier-Admin-2026');
  ok(r.status === 200 && r.data.csrf, 'admin login returns session + CSRF token');
  const csrf = admin.csrf; admin.csrf = null;
  ok((await admin.post('/api/suppliers', { name: 'X' })).status === 403, 'state-changing request without CSRF token is refused');
  admin.csrf = 'forged';
  ok((await admin.post('/api/suppliers', { name: 'X' })).status === 403, 'forged CSRF token is refused');
  admin.csrf = csrf;
  ok((await admin.req('POST', '/api/suppliers', { name: 'X' }, { headers: { Origin: 'https://evil.example' } })).status === 403, 'cross-origin request refused');
  const brute = new Client();
  for (let i = 0; i < 5; i++) await brute.login('victim@azur-papier.example', 'bad' + i);
  ok((await brute.login('victim@azur-papier.example', 'bad')).status === 429, 'login rate limiting after 5 failures');

  // users & roles
  r = await admin.post('/api/admin/users', { name: 'Hanen Mosbah', email: 'hanen@azur-papier.example', role: 'director' });
  ok(r.status === 201 && r.data.temporary_password, 'admin creates director account with temporary password');
  const dirTemp = r.data.temporary_password;
  const analystTemp = (await admin.post('/api/admin/users', { name: 'Analyste Achats', email: 'achats@azur-papier.example', role: 'analyst' })).data.temporary_password;
  const viewerTemp = (await admin.post('/api/admin/users', { name: 'Lecture', email: 'lecture@azur-papier.example', role: 'viewer' })).data.temporary_password;
  const hanen = new Client(); await hanen.login('hanen@azur-papier.example', dirTemp);
  ok((await hanen.get('/api/dashboard')).status === 403, 'temporary password forces a password change before access');
  ok((await hanen.post('/api/auth/password', { current_password: dirTemp, new_password: 'Hanen-Directrice-2026' })).status === 200, 'director changes password');
  ok((await hanen.get('/api/dashboard')).status === 200, 'director can access after password change');
  const analyst = new Client(); await analyst.login('achats@azur-papier.example', analystTemp); await analyst.post('/api/auth/password', { current_password: analystTemp, new_password: 'Analyste-Achats-2026' });
  const viewer = new Client(); await viewer.login('lecture@azur-papier.example', viewerTemp); await viewer.post('/api/auth/password', { current_password: viewerTemp, new_password: 'Lecture-Seule-2026' });

  r = await hanen.get('/api/dashboard');
  ok(r.data.setup_complete === false && r.data.setup.every((s) => !s.done), 'empty database shows guided setup (no fake data)');

  results.push('Phase 2 — industrial data & engines');
  r = await admin.post('/api/admin/connectors/fx', { enabled: true, test: true });
  ok(r.data.ok && r.data.output.saved.length === 2, 'FX connector live test stores EUR/USD rates with source', r.data);
  const fxList = (await hanen.get('/api/fx_rates')).data;
  ok(fxList.every((x) => x.source && x.fetched_at && x.source_type === 'feed'), 'FX records carry source, timestamp and type');
  ok((await analyst.post('/api/fx_rates', { currency: 'EUR', rate_tnd: 3.4, rate_date: '2026-11-14', source: 'BCT fixing' })).status === 201, 'analyst records manual BCT fixing');

  ok((await viewer.post('/api/suppliers', { name: 'Nope' })).status === 403, 'viewer cannot create records');
  const sup = async (name, categories) => (await analyst.post('/api/suppliers', { name, country: 'Tunisie', categories, payment_terms_days: 60 })).data.id;
  const sCap = await sup('Recyclage Cap Bon', 'recovered');
  const sSahel = await sup('Papiers du Sahel', 'recovered');
  const sNord = await sup('Nordic Pulp Trading', 'virgin_pulp');
  ok(sCap && sSahel && sNord, 'suppliers created');
  r = await analyst.post('/api/offers', { supplier_id: 999, category: 'recovered', grade: 'SWL', offer_date: '2026-11-10', price: 1, currency: 'TND' });
  ok(r.status === 422 && r.data.details.supplier_id, 'offer validation rejects unknown supplier');
  r = await analyst.post('/api/offers', { supplier_id: sNord, category: 'virgin_pulp', grade: 'SWL', offer_date: '2026-11-10', price: 1, currency: 'TND' });
  ok(r.status === 422, 'offer validation rejects SWL as virgin pulp');

  const vp = (await analyst.post('/api/offers', { supplier_id: sNord, category: 'virgin_pulp', grade: 'BEKP', offer_date: '2026-11-12', valid_until: '2027-01-31', price: 700, currency: 'USD', freight_tnd_t: 60, moisture_pct: 10, process_loss_pct: 1, payment_terms_days: 90, quantity_t: 1000 })).data.id;
  const swl1 = (await analyst.post('/api/offers', { supplier_id: sCap, category: 'recovered', grade: 'SWL', offer_date: '2026-11-12', valid_until: '2027-01-31', price: 1700, currency: 'TND', freight_tnd_t: 30, processing_tnd_t: 80, energy_extra_tnd_t: 20, chemicals_extra_tnd_t: 25, moisture_pct: 10, contamination_pct: 3, process_loss_pct: 15, payment_terms_days: 60, quantity_t: 500 })).data.id;
  const swl2 = (await analyst.post('/api/offers', { supplier_id: sSahel, category: 'recovered', grade: 'SWL', offer_date: '2026-11-11', valid_until: '2027-01-31', price: 1450, currency: 'TND', freight_tnd_t: 45, processing_tnd_t: 80, energy_extra_tnd_t: 20, chemicals_extra_tnd_t: 25, moisture_pct: 11, contamination_pct: 4, process_loss_pct: 16, payment_terms_days: 30, quantity_t: 400 })).data.id;
  ok(vp && swl1 && swl2, 'virgin pulp and recovered offers created');
  await analyst.post('/api/market_prices', { grade: 'BEKP', price_date: '2026-10-01', price: 760, currency: 'USD', basis: 'CIF Radès', source: 'Saisie test e2e' });
  await analyst.post('/api/market_prices', { grade: 'BEKP', price_date: '2026-11-01', price: 699, currency: 'USD', basis: 'CIF Radès', source: 'Saisie test e2e' });

  const an = (await hanen.get('/api/analysis/fibre')).data;
  const o1 = an.offers.find((o) => o.id === swl1), o2 = an.offers.find((o) => o.id === swl2);
  const usd = an.fx.USD.rate;
  ok(an.references.BEKP?.record.table === 'h360_offers', 'BEKP reference taken from best validated live offer');
  const fin = 0.1 * (30 - 90) / 365;
  const vpEff = (700 * usd + 60 + 700 * usd * fin) / (0.9 * 0.99);
  ok(Math.abs(an.references.BEKP.effective_tnd - vpEff) < 0.01, 'VP effective cost = (landed + financing) / usable yield', { got: an.references.BEKP.effective_tnd, want: vpEff });
  const y1 = 0.9 * 0.97 * 0.85, k1 = 1 + 0.1 * (30 - 60) / 365;
  const pmax = (vpEff * 0.95 * y1 - 155) / k1;
  ok(Math.abs(o1.ceiling.economic_ceiling - pmax) < 0.01, 'SWL buying ceiling matches the closed-form formula', { got: o1.ceiling.economic_ceiling, want: pmax });
  ok(o1.negotiation.above_ceiling === (1700 > o1.ceiling.ceiling), 'offer above ceiling flagged correctly');
  ok(o1.competitor_id === swl2 && o1.negotiation.target_price <= o1.ceiling.ceiling, 'target uses competitor/ceiling and never exceeds ceiling');
  ok(Math.abs(o1.negotiation.expected_savings_tnd - (1700 - o1.negotiation.target_price) * 500) < 0.5, 'expected savings = (offer − target) × quantity');
  ok(an.ranking.SWL[0].effective_tnd <= an.ranking.SWL[1].effective_tnd, 'supplier ranking by effective fibre cost');
  ok(o1.quality_gate.includes('Validation qualité'), 'no substitution approved without quality validation');

  // director exception to the VP nominal cap
  ok((await analyst.post(`/api/offers/${swl1}/ceiling-exception`, { authorize: true, note: 'essai qualité premium validé' })).status === 403, 'analyst cannot authorise ceiling exception');
  ok((await hanen.post(`/api/offers/${swl1}/ceiling-exception`, { authorize: true, note: 'short' })).status === 422, 'exception requires a justification');
  ok((await hanen.post(`/api/offers/${swl1}/ceiling-exception`, { authorize: true, note: 'Lot spécial validé par la qualité' })).status === 200, 'director authorises exception');
  await hanen.post(`/api/offers/${swl1}/ceiling-exception`, { authorize: false });
  ok((await analyst.post(`/api/offers/${swl1}/negotiations`, { event_date: '2026-11-13', kind: 'supplier_reply', price: 1600, note: 'Contre-proposition fournisseur' })).status === 201, 'negotiation event logged');
  ok((await analyst.post(`/api/offers/${swl1}/quality`, { quality_status: 'approved', quality_notes: 'Blancheur 82 ISO' })).status === 200, 'quality validation recorded');

  r = await analyst.post('/api/analysis/ceiling', { grade: 'SWL', price: 1500, currency: 'TND', moisture_pct: 10, contamination_pct: 3, process_loss_pct: 15, freight_tnd_t: 30, processing_tnd_t: 80, energy_extra_tnd_t: 20, chemicals_extra_tnd_t: 25, payment_terms_days: 60 });
  ok(r.status === 200 && Math.abs(r.data.ceiling.economic_ceiling - pmax) < 0.01, 'ceiling calculator endpoint consistent with offer analysis');

  // production periods — manual + CSV import
  const period = (m, s, e, extra = {}) => ({ machine: m, period_start: s, period_end: e, product_grade: '2x17 g/m²', gross_t: 1050, saleable_t: 1000, rejects_t: 50, downtime_h: 20, available_h: 720, vp_t: 400, vp_cost_tnd: 1000000, recovered_t: 700, recovered_cost_tnd: 600000, electricity_kwh: 900000, electricity_tariff: 0.3, gas_nm3: 200000, gas_tariff: 0.5, steam_t: 2000, steam_cost_tnd_t: 40, water_m3: 15000, water_tariff: 1, chemicals_tnd: 120000, packaging_tnd: 40000, labour_tnd: 150000, maintenance_tnd: 80000, fixed_overhead_tnd: 70000, variable_overhead_tnd: 25000, freight_selling_tnd: 50000, avg_selling_price_tnd_t: 3200, closing_stock_t: 100, ...extra });
  ok((await analyst.post('/api/production', period('PM1', '2026-09-01', '2026-09-30'))).status === 201, 'PM1 September period recorded');
  ok((await analyst.post('/api/production', period('PM1', '2026-10-01', '2026-10-31', { electricity_kwh: 1000000, downtime_h: 45, rejects_t: 80 }))).status === 201, 'PM1 October period recorded');
  ok((await analyst.post('/api/production', period('PM1', '2026-10-31', '2026-10-01'))).status === 422, 'period end before start rejected');
  const csv = 'Machine;Début;Fin;Grade produit;Tonnage vendable;Production brute;kWh;Tarif électricité;Coût pâte vierge;Coût fibres recyclées;Chimie;Main d’oeuvre;Prix vente moyen\nPM2;01/09/2026;30/09/2026;1x21;800;840;760000;0,3;700000;520000;90000;120000;3150\nPM2;01/10/2026;31/10/2026;1x21;780;830;800000;0,3;720000;560000;95000;120000;3150\nPM3;01/10/2026;31/10/2026;x;10;10;1;1;1;1;1;1;1\n';
  const fd = new FormData(); fd.append('kind', 'production'); fd.append('file', new Blob([csv], { type: 'text/csv' }), 'pm2.csv');
  r = await analyst.post('/api/imports', undefined, { form: fd });
  ok(r.status === 201 && r.data.rows_total === 3 && r.data.rows_valid === 2, 'CSV import stages rows with per-row validation (PM3 rejected)', r.data);
  ok(r.data.preview[2].errors.machine, 'invalid row carries an explicit error');
  ok(r.data.unmapped.length === 0, 'all French production headers recognised (no silently dropped cost columns)', r.data.unmapped);
  r = await analyst.post(`/api/imports/${r.data.id}/commit`);
  ok(r.data.inserted === 2, 'validated import committed');

  // XLSX import via the downloadable template
  const tpl = await analyst.req('GET', '/api/imports/template/offers', undefined, { raw: true });
  ok(tpl.status === 200 && (await tpl.arrayBuffer()).byteLength > 500, 'Excel template downloadable');
  sh('npx esbuild src/lib/xlsx.ts --bundle --format=esm --platform=neutral --log-level=error --outfile=tests/e2e/.xlsx-build.mjs');
  const { writeXlsx } = await import('./.xlsx-build.mjs');
  const xbytes = writeXlsx([{ name: 'offres', rows: [['fournisseur', 'grade', 'date', 'prix', 'devise', 'quantité', 'humidité', 'contaminants', 'pertes'], ['Papiers du Sahel', 'HWS', '2026-11-12', 1300, 'TND', 200, 8, 1, 8]] }]);
  const fd2 = new FormData(); fd2.append('kind', 'offers'); fd2.append('file', new Blob([xbytes]), 'offres.xlsx');
  r = await analyst.post('/api/imports', undefined, { form: fd2 });
  ok(r.status === 201 && r.data.rows_valid === 1 && r.data.preview[0].data.supplier_id === sSahel && r.data.preview[0].data.category === 'recovered', 'XLSX import resolves supplier names and categories', r.data);
  await analyst.post(`/api/imports/${r.data.id}/commit`);

  const cost = (await hanen.get('/api/analysis/costing?machine=PM1')).data;
  ok(cost.periods.length === 2 && cost.periods[0].result.cost_per_saleable_t > cost.periods[1].result.cost_per_saleable_t, 'PM1 costing computed per saleable tonne');
  ok(cost.variance[0]?.drivers[0].key === 'electricity', 'variance analysis identifies electricity as main driver', cost.variance[0]?.drivers?.[0]);
  const dOffer = (await analyst.get(`/api/defaults/offer?supplier_id=${sCap}&grade=SWL`)).data;
  ok(dOffer.values.processing_tnd_t === 80 && dOffer.values.contamination_pct === 3 && dOffer.previous_price?.price === 1700, 'offer form pre-fills from the supplier’s last offer (only the price is new)', dOffer);
  const dProd = (await analyst.get('/api/defaults/production?machine=PM1')).data;
  ok(dProd.values.period_start === '2026-11-01' && dProd.values.period_end === '2026-11-30' && dProd.values.electricity_tariff === 0.3 && dProd.unit.vp_price_tnd_t === 2500 && dProd.values.electricity_kwh === undefined, 'production form pre-fills next dates, tariffs and prices — never consumptions', dProd);
  const ctx = (await analyst.get('/api/defaults/context')).data;
  ok(ctx.fx.USD > 0 && ctx.references.BEKP && ctx.fin.inventory_days === 30, 'calculation context for live previews available');
  sh('npx esbuild public/js/engine.js --bundle --format=esm --platform=neutral --log-level=error --outfile=tests/e2e/.engine-build.mjs');
  const eng = await import('./.engine-build.mjs');
  const o1live = eng.effectiveCost({ price: 1700, currency: 'TND', fx_tnd: 1, freight_tnd_t: 30, customs_pct: 0, handling_tnd_t: 0, processing_tnd_t: 80, energy_extra_tnd_t: 20, chemicals_extra_tnd_t: 25, other_tnd_t: 0, moisture_pct: 10, contamination_pct: 3, process_loss_pct: 15, payment_terms_days: 60 }, ctx.fin);
  const o1srv = (await hanen.get('/api/analysis/fibre')).data.offers.find((o) => o.id === swl1);
  ok(Math.abs(o1live.effective_tnd_per_usable_t - o1srv.cost.effective_tnd_per_usable_t) < 1e-6, 'browser live preview = server result (same engine code)');
  const energy = (await hanen.get('/api/analysis/energy')).data;
  ok(energy.PM1.gap_to_best_tnd > 0 && energy.PM2, 'energy KPIs and gap to best period computed');
  r = await hanen.post('/api/analysis/price-simulation', { period_id: cost.periods[0].id, proposed_price_tnd_t: 3040, fibre_price_change_pct: -8, save: true, name: 'Baisse 5 % PM1' });
  ok(r.status === 200 && r.data.saved_id && r.data.break_even_price_t > 0 && r.data.verdict, 'Jumbo Roll price simulation computed and saved');
  ok((await viewer.post('/api/analysis/price-simulation', { period_id: cost.periods[0].id, save: true, name: 'x' })).status === 403, 'viewer cannot save simulations');

  results.push('Phase 3 — automation');
  const autoJobs = (await admin.get('/api/admin/jobs')).data.filter((j) => j.type === 'auto_scan');
  ok(autoJobs.length >= 5 && autoJobs.every((j) => j.status === 'succeeded'), 'analysis re-runs automatically after every save (no button needed)', autoJobs.slice(0, 3));
  ok((await hanen.get('/api/recommendations?status=proposed')).data.length > 0, 'recommendations already exist before any manual "Analyser" click');
  r = await analyst.post('/api/analysis/run');
  ok(r.data.ok && (await hanen.get('/api/recommendations?status=proposed')).data.length > 0, 'manual engine scan still available', r.data);
  const recos = (await hanen.get('/api/recommendations?status=proposed')).data;
  const nego = recos.find((x) => x.type === 'negotiation' && x.inputs.offer_id === swl1);
  ok(nego && nego.calc.ceiling && nego.risks && nego.data_freshness && nego.confidence > 0 && nego.missing_info, 'recommendation has inputs, formula, savings, risks, freshness, confidence, missing info');
  ok(recos.some((x) => x.type === 'renegotiation'), 'virgin pulp drop >5% triggers recovered-paper renegotiation recommendation');
  ok(recos.some((x) => x.type === 'cost_variance' && x.module === 'production'), 'cost variance recommendation created');
  const alerts = (await hanen.get('/api/alerts')).data;
  ok(alerts.some((a) => a.type === 'marché'), 'price-change alert raised');
  r = await analyst.post('/api/analysis/run');
  ok(r.data.output.recommendations_created === 0, 'daily re-run is idempotent (no duplicate recommendations)');

  ok((await analyst.post(`/api/recommendations/${nego.id}/decision`, { decision: 'approve' })).status === 403, 'analyst cannot approve recommendations');
  ok((await hanen.post(`/api/recommendations/${nego.id}/decision`, { decision: 'reject' })).status === 422, 'rejection requires a comment');
  r = await hanen.post(`/api/recommendations/${nego.id}/decision`, { decision: 'approve' });
  ok(r.data.status === 'approved' && r.data.external_actions.startsWith('aucune'), 'approval updates internal status only — no external action');
  ok((await hanen.post(`/api/recommendations/${nego.id}/decision`, { decision: 'approve' })).status === 409, 'decision cannot be taken twice');
  const sav = (await hanen.get('/api/savings')).data;
  ok(sav.some((s) => s.recommendation_id === nego.id && s.status === 'validated'), 'approved savings flow into the Savings Center');
  await analyst.put(`/api/savings/${sav[0].id}`, { status: 'realized', realized_tnd: 25000 });
  ok((await hanen.get('/api/analysis/savings')).data.totals.realized === 25000, 'realized vs projected savings tracked');

  // API ingestion (ERP / production systems)
  r = await admin.post('/api/admin/api-keys', { name: 'ERP production', scopes: ['production'] });
  const key = r.data.key;
  ok(key?.startsWith('h360_'), 'scoped ingestion API key created (shown once)');
  const ing = (body, kind = 'production', k = key) => fetch(`${BASE}/api/ingest/${kind}`, { method: 'POST', headers: { Authorization: `Bearer ${k}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  ok((await ing({ rows: [] }, 'production', 'h360_invalid')).status === 401, 'ingestion rejects invalid keys');
  ok((await ing({ rows: [{ a: 1 }] }, 'offers')).status === 403, 'ingestion enforces key scopes');
  const ingRes = await (await ing({ rows: [period('PM2', '2026-11-01', '2026-11-13', { saleable_t: 300 })] })).json();
  ok(ingRes.batch_id && ingRes.rows_valid === 1 && ingRes.status.startsWith('staged'), 'ingested data is staged, not committed automatically', ingRes);
  const conns = (await admin.get('/api/admin/connectors')).data.connectors;
  ok(conns.find((c) => c.id === 'erp').status === 'connected' && conns.find((c) => c.id === 'pulp_feed').display_status === 'Connexion requise', 'connector statuses reflect real checks ("Connexion requise" when absent)');
  ok((await admin.post('/api/admin/connectors/pulp_feed', { enabled: true, test: true })).data.ok === false, 'pulp feed without licence reports failure (no fabricated prices)');

  // Scheduled pipelines through the real cron handler
  let s = await fetch(`${BASE}/__scheduled?cron=${encodeURIComponent('0 5 * * *')}`);
  await new Promise((rs) => setTimeout(rs, 2500));
  const jobs = (await admin.get('/api/admin/jobs')).data;
  const types = new Set(jobs.filter((j) => j.triggered_by === 'cron:daily').map((j) => j.type));
  ok(s.ok && ['fx_update', 'cost_recalculation', 'engine_scan', 'supplier_ranking', 'daily_report'].every((t) => types.has(t)), 'daily cron runs FX, recalculation, scan, ranking and report', [...types]);
  ok(jobs.filter((j) => j.triggered_by === 'cron:daily').every((j) => j.status === 'succeeded' || j.type === 'pulp_feed_sync'), 'daily cron jobs succeeded', jobs.filter((j) => j.status === 'failed').map((j) => [j.type, j.error]));
  s = await fetch(`${BASE}/__scheduled?cron=${encodeURIComponent('0 6 * * 1')}`);
  await new Promise((rs) => setTimeout(rs, 1500));
  ok((await admin.get('/api/admin/jobs')).data.some((j) => j.type === 'weekly_report' && j.status === 'succeeded'), 'weekly cron generates weekly report');
  ok((await admin.get('/api/admin/jobs?status=running')).data.length === 0, 'no job left in running state');

  // Reports & exports
  const reps = (await hanen.get('/api/reports')).data;
  ok(reps.length >= 2, 'reports stored');
  const pdf = await hanen.req('GET', `/api/reports/${reps[0].id}?format=pdf`, undefined, { raw: true });
  const pdfBytes = Buffer.from(await pdf.arrayBuffer());
  ok(pdf.headers.get('content-type') === 'application/pdf' && pdfBytes.subarray(0, 5).toString() === '%PDF-', 'report downloads as PDF');
  const xl = await hanen.req('GET', `/api/reports/${reps[0].id}?format=xlsx`, undefined, { raw: true });
  const xlBytes = Buffer.from(await xl.arrayBuffer());
  ok(xlBytes.subarray(0, 2).toString() === 'PK', 'report downloads as Excel');
  const rep = (await hanen.get(`/api/reports/${reps[0].id}`)).data.data;
  ok(rep.cost_per_tonne.length === 2 && rep.fibre_comparison.length >= 3 && Array.isArray(rep.pending_decisions), 'report contains cost/t, fibre comparison and pending decisions');
  for (const ds of ['fibre_analysis', 'costing', 'offers', 'recommendations']) {
    const e = await hanen.req('GET', `/api/export/${ds}`, undefined, { raw: true });
    ok(e.status === 200 && Buffer.from(await e.arrayBuffer()).subarray(0, 2).toString() === 'PK', `export ${ds} (xlsx)`);
  }
  const csvExp = await hanen.req('GET', '/api/export/offers?format=csv', undefined, { raw: true });
  ok((await csvExp.text()).includes('grade'), 'export CSV');
  ok((await viewer.req('GET', '/api/export/audit', undefined, { raw: true })).status === 403, 'audit export restricted to admin');

  results.push('Phase 4 — Hanen AI');
  const st = (await hanen.get('/api/ai/status')).data;
  ok(st.configured && st.agents.length === 15 && st.agents.every((a) => a.tools.length && a.active.length === 0), '15 specialist agents defined with tools; none shown active when idle');
  ok(!st.director.tools.some((t) => /purchase|send|sign|publish|pay/i.test(t.name)), 'no tool can purchase, contact suppliers, sign or publish prices');
  ok((await viewer.post('/api/ai/chat', { message: 'test' })).status === 403, 'viewer cannot use the AI adviser');
  const before = anthropicLog.length;
  r = await hanen.post('/api/ai/chat', { message: 'Quel est le prix maximum SWL à payer aujourd’hui ?' });
  ok(r.status === 200 && r.data.text.includes('Prix maximum SWL') && r.data.tools_used.includes('get_fibre_analysis'), 'AI answers using real tool data', r.data);
  const reqs = anthropicLog.slice(before);
  ok(reqs[0].body.model === 'claude-opus-5-5' && reqs[0].body.tools.length > 5 && reqs[0].body.system[0].cache_control, 'AI request uses configured model, tools and cached system prompt');
  ok(reqs[1].body.messages.at(-1).content.filter((b) => b.type === 'tool_result').length === 2, 'parallel tool results returned in a single message');
  const toolJson = JSON.parse(reqs[1].body.messages.at(-1).content.find((b) => b.content.includes('"offers"')).content);
  ok(toolJson.offers.some((o) => o.offer_id === swl1 && Math.abs(o.ceiling.economic_ceiling - pmax) < 0.01), 'AI tool output carries the engine’s verified numbers');
  const aiRecos = (await hanen.get('/api/recommendations?status=proposed')).data.filter((x) => x.created_by.startsWith('agent:'));
  ok(aiRecos.length === 1 && aiRecos[0].status === 'proposed', 'AI proposal recorded as "proposed" for Hanen’s decision');
  const conv = r.data.conversation_id;
  r = await hanen.post('/api/ai/chat', { message: 'Et pour HWS ?', conversation_id: conv });
  ok(r.status === 200 && anthropicLog.slice(before).some((x) => x.body.messages.length > 5 && x.body.messages.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'thinking'))), 'follow-up replays full history including thinking & tool blocks');
  ok((await analyst.get(`/api/ai/conversations/${conv}`)).status === 404, 'conversations are private to their owner');
  const toolJobs = (await admin.get('/api/admin/jobs')).data.filter((j) => j.type.startsWith('ai_tool:'));
  ok(toolJobs.length >= 2 && toolJobs.every((j) => j.status === 'succeeded' && j.agent), 'each AI tool call tracked as a job attributed to its specialist');
  r = await hanen.post('/api/ai/agents/recovered_paper_analyst/run', {});
  ok(r.status === 200 && r.data.ok, 'specialist agent analysis runs', r.data);
  const ex = new FormData(); ex.append('file', new Blob([Buffer.from('%PDF-1.4\n% test quotation\n')], { type: 'application/pdf' }), 'cotation.pdf');
  r = await analyst.post('/api/inbound/pdf', undefined, { form: ex });
  ok(r.status === 201 && r.data.extracted.offers[0].grade === 'SOP', 'supplier PDF quotation extracted into a draft', r.data);
  const doc = r.data.id;
  ok(!(await hanen.get('/api/offers')).data.some((o) => o.grade === 'SOP'), 'extraction does not create an offer without validation');
  r = await analyst.post(`/api/inbound/${doc}/convert`, { supplier_id: sCap, category: 'recovered', grade: 'SOP', offer_date: '2026-11-10', price: 1010, currency: 'TND', quantity_t: 300 });
  ok(r.status === 201 && (await hanen.get(`/api/offers/${r.data.offer_id}`)).data.source === 'pdf', 'validated draft becomes an offer with source + audit trail');

  // In-app AI key (encrypted at rest, never returned)
  ok((await analyst.post('/api/admin/ai-key', { key: 'sk-ant-x' })).status === 403, 'only admins can set the AI key');
  ok((await admin.post('/api/admin/ai-key', { key: 'not-a-key' })).status === 422, 'AI key format validated');
  r = await admin.post('/api/admin/ai-key', { key: 'sk-ant-bad-0000000000000000000000000' });
  ok(r.status === 422 && /refusée/.test(r.data.error), 'key rejected by Anthropic is not saved', r.data);
  const realish = 'sk-ant-api03-TESTONLY' + 'x'.repeat(40) + 'Zk9Q';
  r = await admin.post('/api/admin/ai-key', { key: realish });
  ok(r.status === 200 && r.data.hint === 'Zk9Q', 'valid AI key tested and saved from the app', r.data);
  ok((await admin.get('/api/admin/ai-key')).data.stored?.hint === 'Zk9Q', 'only the last 4 characters are ever shown');
  const leakSettings = JSON.stringify((await admin.get('/api/settings')).data);
  const leakBackup = await (await admin.req('GET', '/api/admin/backup', undefined, { raw: true })).text();
  const leakAudit = JSON.stringify((await admin.get('/api/admin/audit')).data);
  ok(![leakSettings, leakBackup, leakAudit].some((x) => x.includes('TESTONLY') || x.includes('secret_anthropic')), 'AI key never appears in settings, backup or audit log');

  results.push('Phase 5 — administration & production readiness');
  const legacy = (await admin.get('/api/admin/legacy')).data;
  ok(legacy.some((t) => t.table === 'users' && t.rows === 2), 'existing application tables discovered read-only');
  r = await admin.post('/api/admin/legacy/import-users', { table: 'users', email_column: 'email', name_column: 'full_name', role: 'viewer' });
  ok(r.data.created.length === 2, 'legacy users migrated (reset link required)');
  ok((await admin.post('/api/admin/legacy/import-users', { table: 'users; DROP TABLE users', email_column: 'email', role: 'viewer' })).status === 422, 'legacy import rejects SQL injection in identifiers');
  const legacyUser = r.data.created[0].id;
  r = await admin.post(`/api/admin/users/${legacyUser}/reset-link`);
  const token = new URL(r.data.url.replace('#/', '')).searchParams.get('token');
  ok((await anon.post('/api/auth/reset', { token, new_password: 'Nouveau-Mot-2026' })).status === 200, 'password recovery via one-time reset link');
  ok((await anon.post('/api/auth/reset', { token, new_password: 'Nouveau-Mot-2026' })).status === 400, 'reset link cannot be reused');
  const lu = new Client();
  ok((await lu.login('hanen.mosbah@azur-papier.example', 'Nouveau-Mot-2026')).status === 200, 'migrated legacy user can sign in');

  r = await hanen.post('/api/auth/mfa/setup');
  const mfaSec = r.data.secret;
  ok((await hanen.post('/api/auth/mfa/enable', { code: '000000' })).status === 422, 'MFA rejects wrong code');
  ok((await hanen.post('/api/auth/mfa/enable', { code: totp(r.data.secret) })).status === 200, 'MFA enabled with TOTP');
  const h2 = new Client();
  r = await h2.login('hanen@azur-papier.example', 'Hanen-Directrice-2026');
  ok(r.data.mfa_required, 'login requires MFA code');
  ok((await h2.get('/api/dashboard')).status === 401, 'session without MFA cannot access data');
  ok((await h2.post('/api/auth/mfa', { code: 'abcdef' })).status === 401, 'wrong MFA code refused');
  ok((await h2.post('/api/auth/mfa', { code: totp(mfaSec) })).status === 200 && (await h2.get('/api/dashboard')).status === 200, 'correct TOTP completes login');

  const audit = (await admin.get('/api/admin/audit')).data;
  ok(['setup.first_admin', 'auth.login', 'offers.create', 'recommendations.approved', 'import.commit', 'offers.ceiling_exception_authorized'].every((a) => audit.some((x) => x.action === a)), 'audit log records security and business actions');
  ok((await viewer.get('/api/admin/audit')).status === 403 && (await hanen.get('/api/admin/users')).status === 403, 'admin endpoints restricted to administrators');
  const bk = await admin.req('GET', '/api/admin/backup', undefined, { raw: true });
  const bkText = await bk.text();
  ok(bk.status === 200 && bkText.includes('h360_offers') && !bkText.includes('password_hash') && !bkText.includes('key_hash'), 'JSON backup exports data without secrets');
  ok((await admin.get('/api/admin/connectors')).data.setup_token_still_set === true, 'admin is warned while SETUP_TOKEN secret remains configured');
  const sec = await fetch(`${BASE}/`);
  ok(sec.headers.get('content-security-policy')?.includes("frame-ancestors 'none'") && sec.headers.get('x-frame-options') === 'DENY', 'security headers on HTML');
  const setCookie = (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@azur-papier.example', password: 'Azur-Papier-Admin-2026' }) })).headers.get('set-cookie');
  ok(/HttpOnly/.test(setCookie) && /Secure/.test(setCookie) && /SameSite=Strict/.test(setCookie) && setCookie.startsWith('__Host-'), 'session cookie is __Host-, HttpOnly, Secure, SameSite=Strict');
  ok((await admin.post('/api/auth/logout')).status === 200 && (await admin.get('/api/dashboard')).status === 401, 'logout invalidates session');
  const dash = (await hanen.get('/api/dashboard')).data;
  ok(dash.setup_complete && dash.machines.PM1 && dash.machines.PM2 && dash.decisions.length, 'dashboard populated from real records after setup');
}

main();
