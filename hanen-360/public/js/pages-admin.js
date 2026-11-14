import { h, api, clear, card, table, statusBadge, badge, tnd, fmt, dateFmt, dtFmt, toast, guard, can, tabs, qs, setQs, modal, download, emptyState, buildForm, confirmBox, session } from './core.js';
import { t, getLang, setLang } from './i18n.js';
import { pageHead, openImport, openEntityForm } from './shared.js';

export async function adminPage(main) {
  if (!can('admin') && !can('approve')) { clear(main).append(card(null, h('p', {}, 'Accès réservé.'))); return; }
  const tab = qs().get('tab') || (can('admin') ? 'users' : 'connections');
  const rerender = () => adminPage(main);
  clear(main);
  main.append(pageHead(t('nav_admin'), 'Utilisateurs, permissions, connexions, planifications, journaux et approbations'));
  const list = [['users', t('users')], ['connections', t('connections')], ['fx', 'Taux de change'], ['automation', t('automation')], ['imports', t('imports')], ['settings', t('settings')], ['api_keys', t('api_keys')], ['audit', t('audit')], ['legacy', t('legacy')], ['backup', t('backup')]]
    .filter(([id]) => can('admin') || ['connections', 'fx', 'automation', 'imports', 'settings'].includes(id));
  main.append(tabs(list, tab, (x) => { setQs({ tab: x }); rerender(); }));
  const body = h('div', { class: 'tab-body' });
  main.append(body);
  const f = { users, connections, fx, automation, imports, settings, api_keys: apiKeys, audit, legacy, backup }[tab];
  await f(body, rerender);
}

async function users(body, rerender) {
  const rows = await api('/api/admin/users');
  const roleLabel = { admin: 'Administrateur', director: 'Directeur (approuve)', analyst: 'Analyste (saisie)', viewer: 'Lecture seule' };
  body.append(h('div', { class: 'filters' }, h('button', { class: 'btn btn-primary', onclick: () => {
    let m; m = modal(t('add'), buildForm([
      { key: 'name', label: t('name'), required: true }, { key: 'email', label: t('email'), type: 'email', required: true },
      { key: 'role', label: 'Rôle', type: 'select', required: true, options: Object.entries(roleLabel) },
    ], {}, async (d) => { const r = await api('/api/admin/users', { method: 'POST', body: d }); m.close(); modal('Compte créé', [h('p', {}, r.note), h('p', {}, 'Mot de passe temporaire : ', h('code', { class: 'secret' }, r.temporary_password))]); rerender(); }));
  } }, '＋ ', t('users'))));
  body.append(table([
    { key: 'name', label: t('name'), render: (u) => h('div', {}, h('strong', {}, u.name), h('small', { class: 'muted block' }, u.email)) },
    { key: 'role', label: 'Rôle', render: (u) => badge(roleLabel[u.role], u.role === 'admin' ? 'warn' : 'info') },
    { key: 'mfa', label: 'MFA', render: (u) => (u.mfa_enabled ? '✓' : '—') },
    { key: 'last', label: 'Dernière connexion', render: (u) => dtFmt(u.last_login_at) },
    { key: 'active', label: t('status'), render: (u) => statusBadge(u.active ? 'active' : 'disabled') },
  ], rows, { onRow: (u) => {
    const sel = h('select', {}, Object.entries(roleLabel).map(([v, l]) => h('option', { value: v, selected: u.role === v }, l)));
    let m; m = modal(u.name, [
      h('label', { class: 'field' }, h('span', {}, 'Rôle'), sel),
      h('div', { class: 'form-actions wrap' },
        h('button', { class: 'btn btn-primary', onclick: async () => { await guard(() => api(`/api/admin/users/${u.id}`, { method: 'PUT', body: { role: sel.value } }), t('saved')); m.close(); rerender(); } }, t('save')),
        h('button', { class: 'btn', onclick: async () => { const r = await guard(() => api(`/api/admin/users/${u.id}/reset-link`, { method: 'POST' })); modal('Lien de réinitialisation', [h('p', {}, r.note), h('code', { class: 'secret' }, r.url)]); } }, 'Lien de réinitialisation'),
        u.mfa_enabled ? h('button', { class: 'btn', onclick: async () => { await guard(() => api(`/api/admin/users/${u.id}/mfa-reset`, { method: 'POST' }), t('saved')); m.close(); rerender(); } }, 'Réinitialiser MFA') : null,
        h('button', { class: 'btn btn-danger-ghost', onclick: async () => { await guard(() => api(`/api/admin/users/${u.id}`, { method: 'PUT', body: { active: u.active ? 0 : 1 } }), t('saved')); m.close(); rerender(); } }, u.active ? t('disable') : t('enable'))),
    ]);
  } }));
}

const CONN_INFO = {
  ai: { name: 'Hanen AI (Claude, Anthropic)', how: '1. console.anthropic.com → Billing : ajouter du crédit. 2. API Keys → Create Key → copier. 3. Coller la clé ci-dessous → Enregistrer. La clé est testée, chiffrée et ne sera plus jamais affichée.' },
  fx: { name: 'Taux de change automatiques', how: 'Source par défaut : open.er-api.com (gratuite, sans clé). Pour la comptabilité, saisir le fixing BCT. Activer puis « Tester ».' },
  pulp_feed: { name: 'Flux prix pâte sous licence', how: 'Abonnement requis (ex. Fastmarkets RISI, TTO). Secrets PULP_FEED_URL et PULP_FEED_TOKEN ; format JSON { prices: [...] } documenté dans le README.' },
  email: { name: 'Cotations par email', how: 'Cloudflare Email Routing → « Send to Worker » hanen-360, puis renseigner les domaines fournisseurs autorisés (Paramètres).' },
  notify: { name: 'Notifications (Teams / Slack)', how: 'Créer un webhook entrant, puis npx wrangler secret put NOTIFY_WEBHOOK_URL. Activer puis « Tester ».' },
  erp: { name: 'ERP / production / compteurs énergie', how: 'Créer une clé API (onglet Clés API) et pousser vers POST /api/ingest/{type}, ou importer les exports Excel/CSV. Les lots restent à valider.' },
};

async function connections(body, rerender) {
  const r = await api('/api/admin/connectors');
  if (r.setup_token_still_set) body.append(h('div', { class: 'notice notice-bad' }, h('strong', {}, 'Sécurité : '), 'le secret d’activation SETUP_TOKEN est toujours configuré. Supprimez-le : ', h('code', {}, 'npx wrangler secret delete SETUP_TOKEN')));
  const grid = h('div', { class: 'grid-2' });
  for (const c of r.connectors) {
    const info = CONN_INFO[c.id] || { name: c.id, how: '' };
    const ds = c.display_status;
    grid.append(card(info.name, [
      h('p', {}, ds === 'connected' ? badge(t('connected'), 'ok') : ds === 'error' ? badge(t('error'), 'bad') : badge(t('connexion_requise'), 'warn'), ' ', h('small', { class: 'muted' }, c.detail || '')),
      h('p', { class: 'small' }, info.how),
      h('p', { class: 'small muted' }, `Dernier test : ${dtFmt(c.last_check_at)} · dernier succès : ${dtFmt(c.last_ok_at)}`),
      c.id === 'ai' && can('admin') ? aiKeyBox(rerender) : null,
      can('admin') ? h('div', { class: 'row' },
        !['ai', 'erp', 'email'].includes(c.id) ? h('button', { class: 'btn btn-sm', onclick: async () => { await guard(() => api(`/api/admin/connectors/${c.id}`, { method: 'POST', body: { enabled: !c.enabled } }), t('saved')); rerender(); } }, c.enabled ? t('disable') : t('enable')) : null,
        ['ai', 'fx', 'pulp_feed', 'notify'].includes(c.id) ? h('button', { class: 'btn btn-sm btn-primary', onclick: async (e) => { e.target.disabled = true; const x = await api(`/api/admin/connectors/${c.id}`, { method: 'POST', body: { test: true } }).catch((er) => ({ ok: false, error: er.message })); toast(x.ok ? '✓ connecté' : x.error, x.ok ? 'ok' : 'error'); rerender(); } }, t('test')) : null) : null,
    ]));
  }
  body.append(grid);
}

function aiKeyBox(rerender) {
  const box = h('div', { class: 'ai-key-box' }, h('p', { class: 'muted small' }, '…'));
  api('/api/admin/ai-key').then((st) => {
    const input = h('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Clé API Anthropic' });
    const msg = h('p', { class: 'small' });
    const save = h('button', { class: 'btn btn-primary', onclick: async () => {
      save.disabled = true; save.textContent = 'Test de la clé…'; msg.textContent = '';
      try { const r = await api('/api/admin/ai-key', { method: 'POST', body: { key: input.value } }); input.value = ''; toast(`Hanen AI connecté ✓ (clé …${r.hint})`); rerender(); }
      catch (e) { msg.textContent = e.message; msg.className = 'small bad'; save.disabled = false; save.textContent = 'Enregistrer et tester'; }
    } }, 'Enregistrer et tester');
    box.replaceChildren(
      st.stored ? h('p', {}, badge(`Clé enregistrée …${st.stored.hint}`, 'ok'), ' ', h('small', { class: 'muted' }, dtFmt(st.stored.updated_at)), ' ',
        h('button', { class: 'btn btn-sm btn-danger-ghost', onclick: async () => { if (await confirmBox('Supprimer la clé IA ?')) { await guard(() => api('/api/admin/ai-key', { method: 'DELETE' })); rerender(); } } }, t('delete'))) : null,
      st.env_secret ? h('p', { class: 'small muted' }, 'Clé configurée côté serveur (secret).') : null,
      st.can_store ? h('div', { class: 'row' }, input, save) : h('p', { class: 'small' }, 'Stockage chiffré indisponible : configurer le secret ANTHROPIC_API_KEY sur l’hébergeur.'),
      msg);
  }).catch(() => box.replaceChildren());
  return box;
}

async function fx(body, rerender) {
  const rows = await api('/api/fx_rates?limit=60');
  body.append(h('div', { class: 'filters' }, can('write') ? h('button', { class: 'btn btn-primary', onclick: () => openEntityForm('fx_rates', { title: 'Taux de change', onSaved: rerender }) }, '＋ ', t('add')) : null, can('write') ? h('button', { class: 'btn', onclick: () => openImport('fx_rates', rerender) }, t('import')) : null));
  body.append(table([{ key: 'rate_date', label: t('date'), render: (r) => dateFmt(r.rate_date) }, { key: 'currency', label: 'Devise' }, { key: 'rate_tnd', label: 'TND', num: true, render: (r) => fmt(r.rate_tnd, 4) }, { key: 'source', label: t('source'), render: (r) => `${r.source} (${r.source_type})` }, { key: 'fetched_at', label: 'Horodatage', render: (r) => dtFmt(r.fetched_at) }], rows, { empty: emptyState(t('step_fx')) }));
}

async function automation(body, rerender) {
  const [sched, jobs] = await Promise.all([api('/api/admin/schedules'), api('/api/admin/jobs')]);
  body.append(h('div', { class: 'grid-2' }, sched.map((s) => card(s.label, [
    h('p', { class: 'small' }, h('code', {}, s.cron), ' UTC'), h('ol', { class: 'small' }, s.steps.map((x) => h('li', {}, x))),
    h('p', { class: 'small muted' }, 'Dernière exécution : ', s.last ? [statusBadge(s.last.status), ' ', dtFmt(s.last.started_at)] : '—'),
    can('approve') ? h('button', { class: 'btn btn-sm btn-primary', onclick: async (e) => { e.target.disabled = true; await guard(() => api(`/api/admin/schedules/${s.id}/run`, { method: 'POST' }), '✓'); rerender(); } }, t('run_now')) : null,
  ]))));
  body.append(card(t('jobs'), table([
    { key: 'started_at', label: 'Début', render: (j) => dtFmt(j.started_at) }, { key: 'type', label: 'Tâche', render: (j) => h('code', {}, j.type) }, { key: 'agent', label: 'Agent' },
    { key: 'status', label: t('status'), render: (j) => statusBadge(j.status) }, { key: 'triggered_by', label: 'Déclencheur' },
    { key: 'res', label: 'Résultat', render: (j) => h('small', {}, j.error || (j.output || '').slice(0, 140)) },
  ], jobs)));
}

async function imports(body, rerender) {
  const rows = await api('/api/imports');
  body.append(h('div', { class: 'filters' }, can('write') ? h('button', { class: 'btn btn-primary', onclick: () => openImport(null, rerender) }, '⤒ ', t('import')) : null));
  body.append(table([
    { key: 'created_at', label: t('date'), render: (r) => dtFmt(r.created_at) }, { key: 'kind', label: 'Type' }, { key: 'filename', label: 'Fichier' }, { key: 'source', label: t('source') },
    { key: 'rows', label: t('rows_valid'), num: true, render: (r) => `${r.rows_valid}/${r.rows_total}` }, { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) },
  ], rows, { onRow: async (r) => {
    const b = await api(`/api/imports/${r.id}`);
    let m; m = modal(`Lot #${r.id} — ${r.kind}`, [
      table([{ key: 'row', label: '#' }, { key: 'valid', label: t('status'), render: (x) => statusBadge(x.valid ? 'validated' : 'rejected') }, { key: 'data', label: t('details'), render: (x) => Object.entries(x.data).filter(([, v]) => v !== null).slice(0, 6).map(([k, v]) => `${k}=${v}`).join(' · ') }, { key: 'errors', label: t('error'), render: (x) => Object.entries(x.errors).map(([k, v]) => `${k}: ${v}`).join('; ') || '—' }], b.rows.slice(0, 200)),
      b.status === 'staged' && can('write') ? h('div', { class: 'form-actions' }, h('button', { class: 'btn', onclick: async () => { await guard(() => api(`/api/imports/${r.id}/reject`, { method: 'POST' })); m.close(); rerender(); } }, t('reject')), h('button', { class: 'btn btn-primary', onclick: async () => { const x = await guard(() => api(`/api/imports/${r.id}/commit`, { method: 'POST' })); toast(`${x.inserted} ✓`); m.close(); rerender(); } }, t('commit'))) : null,
    ], { wide: true });
  } }));
}

const SETTING_LABELS = {
  vp_reference_SWL: 'Référence pâte vierge pour SWL', vp_reference_HWS: 'Référence pâte vierge pour HWS', vp_reference_SOP: 'Référence pâte vierge pour SOP',
  quality_equivalence_SWL: 'Équivalence qualité SWL (%)', quality_equivalence_HWS: 'Équivalence qualité HWS (%)', quality_equivalence_SOP: 'Équivalence qualité SOP (%)',
  vp_default_freight_tnd_t: 'Fret pâte par défaut (TND/t) si référence = prix marché', vp_default_customs_pct: 'Douane pâte par défaut (%)', vp_default_handling_tnd_t: 'Manutention pâte par défaut (TND/t)',
  vp_default_moisture_pct: 'Humidité pâte par défaut (%)', vp_default_process_loss_pct: 'Pertes process pâte (%)', cost_of_capital_pct: 'Coût du capital (%/an)', inventory_days: 'Jours de stock matières',
  negotiation_margin_pct: 'Marge de négociation sous plafond (%)', target_margin_pct: 'Marge cible Jumbo Roll (%)', annual_savings_target_tnd: 'Objectif annuel d’économies (TND)',
  alert_price_change_pct: 'Seuil alerte variation prix (%)', alert_cost_variance_pct: 'Seuil alerte écart coût/t (%)', email_allowed_domains: 'Domaines email fournisseurs autorisés (séparés par virgules)',
  fx_currencies: 'Devises suivies', fx_provider_url: 'URL source de taux ({CUR})', company_name: 'Société', base_currency: 'Devise de base',
};

async function settings(body) {
  const s = await api('/api/settings');
  const fields = Object.keys(s.defaults).map((k) => ({ key: k, label: SETTING_LABELS[k] || k, type: /(_pct|_days|_tnd_t|_tnd)$/.test(k) || k.startsWith('quality_') ? 'number' : 'text', help: `Défaut : ${s.defaults[k] || '—'}` }));
  body.append(h('div', { class: 'notice' }, 'Ces paramètres sont des hypothèses de calcul modifiables par la Direction ; aucun n’est un prix de marché.'));
  body.append(can('approve') ? buildForm(fields, s.values, async (d) => { await api('/api/settings', { method: 'PUT', body: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v ?? ''])) }); toast(t('saved')); }) : h('pre', {}, JSON.stringify(s.values, null, 2)));
}

async function apiKeys(body, rerender) {
  const rows = await api('/api/admin/api-keys');
  body.append(h('div', { class: 'notice' }, 'Pour les exports ERP, production PM1/PM2 et compteurs d’énergie : ', h('code', {}, 'POST /api/ingest/{production|offers|market_prices|fx_rates|suppliers}'), ' avec ', h('code', {}, 'Authorization: Bearer h360_…'), ' et ', h('code', {}, '{"rows":[{…}]}'), '. Les lots sont mis en attente de validation.'));
  body.append(h('div', { class: 'filters' }, h('button', { class: 'btn btn-primary', onclick: () => {
    const scopes = ['production', 'offers', 'market_prices', 'fx_rates', 'suppliers'];
    const boxes = scopes.map((s) => h('label', { class: 'field-check' }, h('input', { type: 'checkbox', value: s }), ' ', s));
    const name = h('input', { required: true, placeholder: 'ERP Sage — production' });
    let m; m = modal(t('api_keys'), [h('label', { class: 'field' }, h('span', {}, t('name')), name), h('div', { class: 'row wrap' }, boxes), h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-primary', onclick: async () => {
      const r = await guard(() => api('/api/admin/api-keys', { method: 'POST', body: { name: name.value, scopes: boxes.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => i.value) } }));
      m.close(); modal('Clé créée', [h('p', {}, r.note), h('code', { class: 'secret' }, r.key)]); rerender();
    } }, t('save')))]);
  } }, '＋ ', t('api_keys'))));
  body.append(table([{ key: 'name', label: t('name') }, { key: 'prefix', label: 'Préfixe', render: (k) => h('code', {}, k.prefix + '…') }, { key: 'scopes', label: 'Portées' }, { key: 'last_used_at', label: 'Dernier usage', render: (k) => dtFmt(k.last_used_at) }, { key: 'st', label: t('status'), render: (k) => (k.revoked_at ? statusBadge('disabled') : h('button', { class: 'btn btn-sm btn-danger-ghost', onclick: async (e) => { e.stopPropagation(); if (await confirmBox('Révoquer cette clé ?')) { await guard(() => api(`/api/admin/api-keys/${k.id}/revoke`, { method: 'POST' })); rerender(); } } }, 'Révoquer')) }], rows));
}

async function audit(body) {
  const q = h('input', { type: 'search', placeholder: t('search') });
  const list = h('div');
  const load = async () => list.replaceChildren(table([{ key: 'created_at', label: t('date'), render: (a) => dtFmt(a.created_at) }, { key: 'actor', label: 'Acteur' }, { key: 'action', label: 'Action', render: (a) => h('code', {}, a.action) }, { key: 'entity', label: 'Objet', render: (a) => (a.entity ? `${a.entity} #${a.entity_id ?? ''}` : '—') }, { key: 'detail', label: t('details'), render: (a) => h('small', {}, (a.detail || '').slice(0, 160)) }, { key: 'ip', label: 'IP' }], await api(`/api/admin/audit?q=${encodeURIComponent(q.value)}`)));
  q.addEventListener('input', () => { clearTimeout(q._t); q._t = setTimeout(load, 300); });
  body.append(h('div', { class: 'filters' }, q, h('button', { class: 'btn', onclick: () => download('/api/export/audit', 'audit.xlsx') }, t('export'))), list);
  await load();
}

async function legacy(body, rerender) {
  const rows = await api('/api/admin/legacy');
  body.append(h('div', { class: 'notice' }, 'Tables de l’application précédente présentes dans la même base D1. Elles sont conservées intactes et en lecture seule. Vous pouvez migrer les comptes utilisateurs (un lien de réinitialisation sera nécessaire).'));
  body.append(table([{ key: 'table', label: 'Table', render: (r) => h('code', {}, r.table) }, { key: 'rows', label: 'Lignes', num: true }, { key: 'columns', label: 'Colonnes', render: (r) => h('small', {}, r.columns.join(', ')) }], rows, {
    empty: emptyState('Aucune table antérieure détectée dans cette base.'),
    onRow: (r) => {
      let m; m = modal(`Migrer les utilisateurs de ${r.table}`, buildForm([
        { key: 'email_column', label: 'Colonne email', type: 'select', required: true, options: r.columns.map((c) => [c, c]), default: r.columns.find((c) => /mail/i.test(c)) },
        { key: 'name_column', label: 'Colonne nom', type: 'select', options: r.columns.map((c) => [c, c]), default: r.columns.find((c) => /name|nom/i.test(c)) },
        { key: 'role', label: 'Rôle attribué', type: 'select', required: true, options: [['viewer', 'Lecture seule'], ['analyst', 'Analyste'], ['director', 'Directeur'], ['admin', 'Administrateur']] },
      ], {}, async (d) => { const x = await api('/api/admin/legacy/import-users', { method: 'POST', body: { ...d, table: r.table } }); m.close(); modal('Migration', [h('p', {}, `${x.created.length} compte(s) créé(s).`), h('p', {}, x.note)]); }));
    },
  }));
}

async function backup(body) {
  body.append(card('Sauvegarde', [
    h('p', {}, '1. Sauvegarde complète SQL (recommandée avant chaque migration) :'), h('pre', {}, 'npx wrangler d1 export hanen-360-db --remote --output backups/hanen360-$(date +%F).sql'),
    h('p', {}, '2. Restauration à un instant donné (30 jours) : D1 Time Travel'), h('pre', {}, 'npx wrangler d1 time-travel restore hanen-360-db --timestamp=<ISO8601>'),
    h('p', {}, '3. Export applicatif JSON (sans secrets) :'), h('button', { class: 'btn btn-primary', onclick: () => download('/api/admin/backup', 'backup.json') }, '⤓ ', t('export')),
  ]));
}

export async function accountPage(main) {
  const u = session.user;
  clear(main);
  main.append(pageHead(t('nav_account'), `${u.name} · ${u.email} · ${u.role}`));
  main.append(card(t('language'), h('div', { class: 'row' }, ['fr', 'ar', 'en'].map((l) => h('button', { class: `btn ${getLang() === l ? 'btn-primary' : ''}`, onclick: async () => { setLang(l); await api('/api/auth/lang', { method: 'POST', body: { lang: l } }).catch(() => {}); window.__h360render(); } }, { fr: 'Français', ar: 'العربية', en: 'English' }[l])))));
  main.append(card(t('change_password'), buildForm([{ key: 'current_password', label: t('current_password'), type: 'password', required: true, autocomplete: 'current-password' }, { key: 'new_password', label: t('new_password'), type: 'password', required: true, autocomplete: 'new-password', help: '12 caractères min., 3 types de caractères' }], {}, async (d) => { await api('/api/auth/password', { method: 'POST', body: d }); toast(t('saved')); })));
  const mfaBody = h('div');
  const drawMfa = () => {
    mfaBody.replaceChildren(u.mfa_enabled ? h('div', {}, h('p', {}, badge('MFA active', 'ok')), buildForm([{ key: 'password', label: t('password'), type: 'password', required: true }], {}, async (d) => { await api('/api/auth/mfa/disable', { method: 'POST', body: d }); u.mfa_enabled = 0; toast(t('saved')); drawMfa(); }, { submitLabel: t('mfa_disable') }))
      : h('div', {}, h('p', { class: 'muted' }, 'Application d’authentification (Google Authenticator, Microsoft Authenticator, 1Password…).'), h('button', { class: 'btn btn-primary', onclick: async () => {
        const r = await guard(() => api('/api/auth/mfa/setup', { method: 'POST' }));
        mfaBody.replaceChildren(h('p', {}, 'Ajoutez ce secret dans votre application (saisie manuelle) :'), h('code', { class: 'secret' }, r.secret), h('p', { class: 'small muted' }, r.otpauth_uri),
          buildForm([{ key: 'code', label: t('mfa_code'), required: true, autocomplete: 'one-time-code' }], {}, async (d) => { await api('/api/auth/mfa/enable', { method: 'POST', body: d }); u.mfa_enabled = 1; toast(t('saved')); drawMfa(); }, { submitLabel: t('mfa_enable') }));
      } }, t('mfa_enable'))));
  };
  drawMfa();
  main.append(card(t('mfa'), mfaBody));
}
