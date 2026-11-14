import { h, api, session, clear, toast, guard, $ } from './core.js';
import { t, getLang, setLang, applyDir } from './i18n.js';
import { dashboardPage, aiPage } from './pages-exec.js';
import { purchasingPage, pulpPage, recoveredPage } from './pages-buy.js';
import { productionPage, energyPage, pricingPage, savingsPage, reportsPage } from './pages-make.js';
import { adminPage, accountPage } from './pages-admin.js';
import { calcPage } from './pages-calc.js';

const NAV = [
  ['dashboard', '▦', dashboardPage], ['calc', '🧮', calcPage], ['ai', '✦', aiPage], ['purchasing', '⇄', purchasingPage], ['pulp', '❋', pulpPage],
  ['recovered', '♻', recoveredPage], ['production', '⚙', productionPage], ['energy', 'ϟ', energyPage], ['pricing', '◈', pricingPage],
  ['savings', '€', savingsPage], ['reports', '▤', reportsPage], ['admin', '⛭', adminPage], ['account', '◉', accountPage],
];
const BOTTOM = ['dashboard', 'purchasing', 'ai', 'production'];
const root = document.getElementById('app');

async function refreshSession() {
  const s = await api('/api/auth/status');
  session.csrf = s.csrf; session.user = s.user;
  return s;
}

function langSwitch() {
  return h('div', { class: 'lang-switch', role: 'group', 'aria-label': t('language') }, ['fr', 'ar', 'en'].map((l) => h('button', {
    class: getLang() === l ? 'active' : '', 'aria-pressed': getLang() === l ? 'true' : 'false',
    onclick: async () => { setLang(l); if (session.user) api('/api/auth/lang', { method: 'POST', body: { lang: l } }).catch(() => {}); render(); },
  }, l.toUpperCase())));
}

function authShell(title, ...content) {
  clear(root).append(h('main', { class: 'auth' }, h('div', { class: 'auth-card' },
    h('div', { class: 'brand brand-lg' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, 'H'), h('div', {}, h('strong', {}, t('app')), h('small', {}, t('company')))),
    h('h1', {}, title), ...content, langSwitch())));
}

function loginPage(status) {
  if (status.setup_required) return setupPage(status);
  if (status.mfa_pending) {
    const code = h('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, pattern: '\\d{6}', required: true });
    const f = h('form', { class: 'form', onsubmit: async (e) => { e.preventDefault(); await guard(() => api('/api/auth/mfa', { method: 'POST', body: { code: code.value } })); go('dashboard'); } },
      h('label', { class: 'field' }, h('span', {}, t('mfa_code')), code), h('button', { class: 'btn btn-primary btn-block' }, t('verify')));
    return authShell(t('login'), f);
  }
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const pw = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const err = h('p', { class: 'form-error', role: 'alert' });
  const f = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { email: email.value, password: pw.value } });
      session.csrf = r.csrf;
      await start();
    } catch (x) { err.textContent = x.message; }
  } }, h('label', { class: 'field' }, h('span', {}, t('email')), email), h('label', { class: 'field' }, h('span', {}, t('password')), pw), err,
    h('button', { class: 'btn btn-primary btn-block' }, t('signin')), h('p', { class: 'muted small' }, t('forgot')));
  authShell(t('login'), f);
}

function setupPage(status) {
  if (!status.setup_token_configured) return authShell(t('setup_title'), h('p', {}, 'Secret SETUP_TOKEN absent. Administrateur : exécutez ', h('code', {}, 'npx wrangler secret put SETUP_TOKEN'), ' puis rechargez.'));
  const tok = h('input', { type: 'password', required: true, autocomplete: 'off' });
  const name = h('input', { required: true, value: 'Hanen Mosbah', autocomplete: 'name' });
  const email = h('input', { type: 'email', required: true, autocomplete: 'username' });
  const pw = h('input', { type: 'password', required: true, autocomplete: 'new-password', minlength: 12 });
  const err = h('p', { class: 'form-error', role: 'alert' });
  authShell(t('setup_title'), h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault(); err.textContent = '';
    try { const r = await api('/api/auth/setup', { method: 'POST', body: { token: tok.value, name: name.value, email: email.value, password: pw.value } }); toast(r.next); render(); }
    catch (x) { err.textContent = x.message; }
  } }, h('label', { class: 'field' }, h('span', {}, t('setup_token')), tok), h('label', { class: 'field' }, h('span', {}, t('name')), name), h('label', { class: 'field' }, h('span', {}, t('email')), email),
    h('label', { class: 'field' }, h('span', {}, t('password')), pw, h('small', { class: 'help' }, '12 caractères min., 3 types parmi minuscules/majuscules/chiffres/symboles')), err, h('button', { class: 'btn btn-primary btn-block' }, t('create_admin'))));
}

function resetPage() {
  const token = new URLSearchParams(location.hash.split('?')[1] || '').get('token') || '';
  const pw = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
  authShell(t('reset_title'), h('form', { class: 'form', onsubmit: async (e) => { e.preventDefault(); await guard(() => api('/api/auth/reset', { method: 'POST', body: { token, new_password: pw.value } }), t('saved')); location.hash = '#/login'; } },
    h('label', { class: 'field' }, h('span', {}, t('new_password')), pw), h('button', { class: 'btn btn-primary btn-block' }, t('save'))));
}

function mustChangePage() {
  const cur = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const pw = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
  authShell(t('change_password'), h('p', {}, t('must_change')), h('form', { class: 'form', onsubmit: async (e) => { e.preventDefault(); await guard(() => api('/api/auth/password', { method: 'POST', body: { current_password: cur.value, new_password: pw.value } }), t('saved')); await start(); } },
    h('label', { class: 'field' }, h('span', {}, t('current_password')), cur), h('label', { class: 'field' }, h('span', {}, t('new_password')), pw), h('button', { class: 'btn btn-primary btn-block' }, t('save'))));
}

export function go(route) { location.hash = `#/${route}`; }

function moreSheet() {
  const back = h('div', { class: 'sheet-back', onclick: (e) => { if (e.target === back) back.remove(); } },
    h('nav', { class: 'sheet', 'aria-label': t('nav_more') }, h('div', { class: 'sheet-grip' }),
      h('div', { class: 'sheet-grid' }, NAV.filter(([id]) => id !== 'admin' || session.user?.role === 'admin').map(([id, ico]) => h('a', { href: `#/${id}`, onclick: () => back.remove() }, h('span', { class: 'ico' }, ico), h('span', {}, t('nav_' + id))))),
      h('div', { class: 'sheet-foot' }, langSwitch(), h('button', { class: 'btn', onclick: logout }, t('logout')))));
  document.body.append(back);
}

async function logout() { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); session.user = null; session.csrf = null; location.hash = '#/login'; render(); }

function shell(active) {
  const nav = NAV.filter(([id]) => id !== 'admin' || session.user?.role === 'admin');
  const main = h('main', { id: 'main', class: 'main', tabindex: -1 });
  clear(root).append(
    h('a', { class: 'skip', href: '#main' }, { fr: 'Aller au contenu', en: 'Skip to content', ar: 'انتقل إلى المحتوى' }[getLang()]),
    h('aside', { class: 'sidebar', 'aria-label': 'Navigation' },
      h('div', { class: 'brand' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, 'H'), h('div', {}, h('strong', {}, t('app')), h('small', {}, t('company')))),
      h('nav', {}, nav.map(([id, ico]) => h('a', { href: `#/${id}`, class: id === active ? 'active' : '', 'aria-current': id === active ? 'page' : undefined }, h('span', { class: 'ico', 'aria-hidden': 'true' }, ico), h('span', {}, t('nav_' + id))))),
      h('div', { class: 'side-foot' }, langSwitch(), h('div', { class: 'who' }, h('strong', {}, session.user.name), h('small', {}, session.user.role)), h('button', { class: 'btn btn-ghost', onclick: logout }, t('logout')))),
    h('header', { class: 'topbar' }, h('div', { class: 'brand' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, 'H'), h('strong', {}, t('nav_' + active))), h('a', { class: 'icon-btn', href: '#/account', 'aria-label': t('nav_account') }, '◉')),
    main,
    h('nav', { class: 'bottom-nav', 'aria-label': 'Navigation mobile' },
      BOTTOM.map((id) => h('a', { href: `#/${id}`, class: `${id === active ? 'active' : ''} ${id === 'ai' ? 'bn-ai' : ''}`, 'aria-current': id === active ? 'page' : undefined }, h('span', { class: 'ico', 'aria-hidden': 'true' }, NAV.find((n) => n[0] === id)[1]), h('span', {}, t('short_' + id)))),
      h('button', { class: BOTTOM.includes(active) ? '' : 'active', onclick: moreSheet }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '☰'), h('span', {}, t('nav_more')))),
  );
  return main;
}

async function render() {
  applyDir();
  document.querySelectorAll('.modal-back,.sheet-back').forEach((x) => x.remove());
  document.body.classList.remove('modal-open');
  const route = (location.hash.replace(/^#\//, '').split('?')[0] || 'dashboard');
  if (route === 'reset') return resetPage();
  let status;
  try { status = await refreshSession(); } catch (e) { return authShell('Hanen 360', h('p', { class: 'form-error' }, e.message)); }
  if (!status.authenticated) return loginPage(status);
  if (session.user.must_change_password) return mustChangePage();
  const entry = NAV.find(([id]) => id === route) || NAV[0];
  const main = shell(entry[0]);
  main.append(h('div', { class: 'loading' }, t('loading')));
  try { await entry[2](main); }
  catch (e) { clear(main).append(h('div', { class: 'card' }, h('p', { class: 'form-error' }, e.message))); }
  document.title = `${t('nav_' + entry[0])} · Hanen 360`;
}

async function start() {
  if (!location.hash || location.hash === '#/login') location.hash = '#/dashboard';
  else await render();
}

window.addEventListener('hashchange', render);
window.__h360render = render;
start();
