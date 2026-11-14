// Mobile (iPhone) + desktop UI checks with Playwright against the local Worker.
// Run after `npm run test:e2e` (reuses its local database):  node tests/e2e/ui.mjs
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PORT = 8798, BASE = `http://localhost:${PORT}`;
const OUT = process.env.SHOTS || 'test-results/screens';
mkdirSync(OUT, { recursive: true });
const ROUTES = ['dashboard', 'ai', 'ai?tab=decisions', 'ai?tab=team', 'purchasing', 'purchasing?tab=offers', 'purchasing?tab=comparison', 'pulp', 'recovered', 'production', 'energy', 'pricing', 'savings', 'reports', 'admin', 'admin?tab=connections', 'admin?tab=automation', 'account'];
let passed = 0, failed = 0; const lines = [];
const ok = (c, n, x) => { c ? passed++ : failed++; lines.push(`  ${c ? '✓' : '✗'} ${n}${!c && x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 300) : ''}`); };

async function waitFor(url) { for (let i = 0; i < 120; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 500)); } throw new Error('server not up'); }

async function login(page) {
  await page.goto(`${BASE}/#/login`);
  await page.fill('input[type=email]', 'admin@azur-papier.example');
  await page.fill('input[type=password]', 'Azur-Papier-Admin-2026');
  await page.click('button.btn-primary');
  await page.waitForSelector('.main .page-head, .main .ai-hero', { timeout: 15000 });
}

async function checkRoutes(page, label, deviceWidth, shots) {
  for (const r of ROUTES) {
    const errors = [];
    const onErr = (m) => { if (m.type() === 'error') errors.push(m.text()); };
    page.on('console', onErr); page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/#/${r}`);
    await page.waitForSelector('.main .page-head, .main .ai-hero', { timeout: 15000 });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, err: document.querySelector('.main .form-error')?.textContent || '' }));
    ok(m.sw <= deviceWidth + 1 && m.iw <= deviceWidth + 1, `${label} /${r}: no horizontal overflow (${m.sw}px ≤ ${deviceWidth}px)`, m);
    ok(!errors.length && !m.err, `${label} /${r}: no JS/API errors`, errors.concat(m.err || []));
    page.off('console', onErr);
    if (shots.includes(r)) await page.screenshot({ path: `${OUT}/${label}-${r.replace(/[?=&]/g, '_')}.png`, fullPage: false });
  }
}

async function main() {
  const dev = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1'], { stdio: 'ignore' });
  try {
    await waitFor(`${BASE}/api/health`);
    const browser = await chromium.launch();

    // iPhone 14 — French
    const ctx = await browser.newContext({ ...devices['iPhone 14'] });
    const page = await ctx.newPage();
    await login(page);
    lines.push('iPhone 14 (390×844) — Français');
    const nav = await page.evaluate(() => { const b = document.querySelector('.bottom-nav'); const s = getComputedStyle(b); return { visible: s.display !== 'none', items: b.querySelectorAll('a,button').length, side: getComputedStyle(document.querySelector('.sidebar')).display }; });
    ok(nav.visible && nav.items === 5 && nav.side === 'none', 'bottom navigation visible with 5 targets; sidebar hidden', nav);
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.bottom-nav a, .bottom-nav button, .action-bar .btn')].map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
    ok(sizes.every((s) => s >= 40), 'touch targets ≥ 40px (nav + Add/Import/Analyze/Export)', sizes);
    const actions = await page.$$eval('.action-bar .btn', (b) => b.map((x) => x.textContent.trim()));
    ok(['Ajouter', 'Importer', 'Analyser', 'Exporter'].every((a) => actions.some((x) => x.includes(a))), 'Add / Import / Analyze / Export visible on dashboard', actions);
    await page.screenshot({ path: `${OUT}/iphone-dashboard-full.png`, fullPage: true });
    await checkRoutes(page, 'iphone', 390, ['dashboard', 'ai', 'ai?tab=decisions', 'purchasing?tab=offers', 'recovered', 'production', 'pricing', 'admin?tab=connections']);

    // "More" sheet and full-screen modal
    await page.goto(`${BASE}/#/dashboard`); await page.waitForSelector('.page-head');
    await page.click('.bottom-nav button');
    ok(await page.isVisible('.sheet'), '"Plus" sheet opens with all modules');
    ok((await page.$$('.sheet-grid a')).length >= 11, 'sheet lists every module');
    await page.screenshot({ path: `${OUT}/iphone-more-sheet.png` });
    await page.click('.sheet-grid a[href="#/production"]');
    await page.waitForSelector('.page-head');
    await page.click('.action-bar .btn-primary');
    await page.waitForSelector('.modal');
    const modal = await page.evaluate(() => { const r = document.querySelector('.modal').getBoundingClientRect(); return { w: r.width, h: r.height, iw: innerWidth, ih: innerHeight }; });
    ok(modal.w >= modal.iw - 1 && modal.h >= modal.ih - 1, 'forms open full-screen on iPhone', modal);
    await page.screenshot({ path: `${OUT}/iphone-production-form.png` });

    // Interaction: add a supplier through the UI and see it listed
    await page.goto(`${BASE}/#/purchasing?add=1`);
    await page.waitForSelector('.modal input[name=name]');
    await page.fill('.modal input[name=name]', 'Fournisseur UI Test');
    await page.click('.modal button[type=submit]');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForSelector('text=Fournisseur UI Test');
    ok(true, 'supplier created from the mobile form appears in the list');

    // Live calculations: offer form (pre-fill + instant ceiling verdict)
    await page.goto(`${BASE}/#/dashboard`); await page.waitForSelector('.quick-btn');
    await page.click('.quick-btn:has-text("Offre fournisseur")');
    await page.waitForSelector('.modal select[name=supplier_id]');
    const capId = await page.$eval('.modal select[name=supplier_id]', (s) => [...s.options].find((o) => o.text === 'Recyclage Cap Bon').value);
    await page.selectOption('.modal select[name=supplier_id]', capId);
    await page.selectOption('.modal select[name=grade]', 'SWL');
    await page.waitForFunction(() => document.querySelector('.modal input[name=processing_tnd_t]').value === '80', null, { timeout: 8000 }).catch(() => {});
    ok(await page.inputValue('.modal input[name=processing_tnd_t]') === '80' && await page.inputValue('.modal select[name=category]') === 'recovered', 'offer form auto-fills costs from history and sets category from grade');
    await page.fill('.modal input[name=price]', '1800');
    await page.waitForFunction(() => document.querySelector('.live-preview')?.textContent.includes('Au-dessus du plafond'), null, { timeout: 5000 }).catch(() => {});
    const pv = await page.textContent('.live-preview');
    ok(pv.includes('Coût effectif') && pv.includes('Prix maximum') && pv.includes('Au-dessus du plafond') && pv.includes('Offre précédente'), 'typing a price shows effective cost, ceiling, target and verdict instantly', pv.slice(0, 300));
    await page.screenshot({ path: `${OUT}/iphone-offer-live.png` });
    await page.click('.modal .modal-head button');

    // Live calculations: production form
    await page.click('.quick-btn:has-text("Période PM1")');
    await page.waitForSelector('.modal select[name=machine]');
    await page.selectOption('.modal select[name=machine]', 'PM1');
    await page.waitForFunction(() => document.querySelector('.modal input[name=electricity_tariff]').value !== '', null, { timeout: 8000 }).catch(() => {});
    ok(await page.inputValue('.modal input[name=electricity_tariff]') === '0.3' && await page.inputValue('.modal input[name=period_start]') === '2026-11-01' && await page.inputValue('.modal input[name=electricity_kwh]') === '', 'production form pre-fills dates & tariffs, leaves consumptions empty');
    await page.fill('.modal input[name=saleable_t]', '900');
    await page.fill('.modal input[name=gross_t]', '950');
    await page.fill('.modal input[name=vp_t]', '350');
    await page.fill('.modal input[name=vp_price_tnd_t]', '2400');
    await page.fill('.modal input[name=electricity_kwh]', '820000');
    await page.waitForTimeout(400);
    ok(await page.inputValue('.modal input[name=vp_cost_tnd]') === '840000' && await page.inputValue('.modal input[name=rejects_t]') === '50', 'totals and rejects computed automatically (350 t × 2400 = 840 000; 950 − 900 = 50)');
    const pp = await page.textContent('.live-preview');
    ok(pp.includes('Coût / t vendable') && pp.includes('Prix cible'), 'cost per tonne and target price shown while typing', pp.slice(0, 200));
    await page.screenshot({ path: `${OUT}/iphone-production-live.png` });
    await page.click('.modal .modal-head button');

    // Live pricing simulation
    await page.goto(`${BASE}/#/pricing`); await page.waitForSelector('input[name=price_change_pct]');
    await page.fill('input[name=price_change_pct]', '-5');
    await page.waitForFunction(() => document.querySelector('.sim-out .verdict'), null, { timeout: 5000 }).catch(() => {});
    ok((await page.textContent('.sim-out')).includes('Δ profit'), 'price simulation updates instantly (−5 % → profit impact)');
    await page.screenshot({ path: `${OUT}/iphone-pricing-live.png` });

    // Decision workflow from the phone
    await page.goto(`${BASE}/#/ai?tab=decisions`);
    await page.waitForSelector('.reco');
    ok((await page.$$('.reco-actions .btn')).length >= 3, 'Approve / More analysis / Reject buttons on recommendations');

    // Arabic RTL
    await page.goto(`${BASE}/#/account`); await page.waitForSelector('.page-head');
    await page.click('text=العربية');
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/#/dashboard`); await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('لوحة'), null, { timeout: 10000 }).catch(() => {});
    const ar = await page.evaluate(() => ({ dir: document.documentElement.dir, h1: document.querySelector('h1').textContent, sw: document.documentElement.scrollWidth, iw: innerWidth }));
    ok(ar.dir === 'rtl' && ar.h1.includes('لوحة'), 'Arabic switches to RTL with translated UI', ar);
    ok(ar.sw <= 391 && ar.iw <= 391, 'no horizontal overflow in Arabic', ar);
    await page.screenshot({ path: `${OUT}/iphone-dashboard-ar.png` });
    lines.push('iPhone 14 — العربية (RTL)');
    await checkRoutes(page, 'iphone-ar', 390, ['ai', 'production']);
    await page.goto(`${BASE}/#/account`); await page.waitForSelector('.page-head');
    await page.click('text=English'); await page.waitForTimeout(300);
    await page.goto(`${BASE}/#/ai`); await page.waitForSelector('.ai-hero');
    ok((await page.textContent('h1')).includes('Economic & Financial Expert'), 'English UI available');
    await page.goto(`${BASE}/#/account`); await page.waitForSelector('.page-head'); await page.click('text=Français');
    await ctx.close();

    // Desktop
    lines.push('Desktop (1440×900)');
    const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const dp = await dctx.newPage();
    await login(dp);
    ok(await dp.isVisible('.sidebar') && !(await dp.isVisible('.bottom-nav')), 'desktop uses sidebar navigation');
    await checkRoutes(dp, 'desktop', 1440, ['dashboard', 'purchasing?tab=offers', 'production', 'ai?tab=team']);
    await dctx.close();

    // Empty-state onboarding (fresh viewer has the same data, so check the API-driven guided setup text exists in bundle)
    await browser.close();
  } finally { dev.kill('SIGTERM'); }
  console.log(lines.join('\n'));
  console.log(`\n${passed} passed, ${failed} failed`);
  writeFileSync(`${OUT}/ui-results.txt`, lines.join('\n') + `\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}
main();
