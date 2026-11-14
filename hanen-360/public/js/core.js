import { t, L, locale, getLang } from './i18n.js';

// ───────── DOM (all text goes through textContent → no HTML injection) ─────────
// Native append()/prepend()/replaceChildren() render null/false as text; skip them app-wide.
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  for (const m of ['append', 'prepend', 'replaceChildren']) {
    const orig = proto[m];
    proto[m] = function (...nodes) { return orig.apply(this, nodes.flat(Infinity).filter((n) => n !== null && n !== undefined && n !== false)); };
  }
}
export function h(tag, attrs = {}, ...children) {
  const el = document.createElementNS(tag === 'svg' || attrs.__svg ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml', tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === '__svg' || v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value' && 'value' in el) el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const svg = (tag, attrs = {}, ...c) => h(tag, { ...attrs, __svg: true }, ...c);
export const $ = (s, r = document) => r.querySelector(s);
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

// ───────── Formatting ─────────
export function fmt(n, d = 0) {
  if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
}
export const tnd = (n, d = 0) => (n === null || n === undefined ? '—' : `${fmt(n, d)} TND`);
export const pct = (n, d = 1) => (n === null || n === undefined ? '—' : `${fmt(n, d)} %`);
export const dateFmt = (s) => (s ? new Date(s.length <= 10 ? s + 'T00:00:00Z' : s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z')).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const dtFmt = (s) => (s ? new Date(s.replace(' ', 'T') + (s.includes('Z') || s.includes('+') ? '' : 'Z')).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const todayIso = () => new Date().toISOString().slice(0, 10);

// ───────── API ─────────
export const session = { csrf: null, user: null };
export class ApiError extends Error { constructor(status, msg, details) { super(msg); this.status = status; this.details = details; } }

export async function api(path, { method = 'GET', body, form, raw } = {}) {
  const headers = {};
  if (method !== 'GET' && session.csrf) headers['X-CSRF-Token'] = session.csrf;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let res;
  try { res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' }); }
  catch { throw new ApiError(0, t('offline')); }
  if (raw) { if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({}))).error || res.statusText); return res; }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/api/auth/')) { location.hash = '#/login'; }
  if (!res.ok) throw new ApiError(res.status, data.error || res.statusText, data.details);
  return data;
}

export async function download(path, fallbackName) {
  try {
    const res = await api(path, { raw: true });
    const blob = await res.blob();
    const name = (res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || fallbackName;
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch (e) { toast(e.message, 'error'); }
}

// ───────── Feedback ─────────
export function toast(msg, kind = 'ok') {
  const box = $('#toasts') || document.body.appendChild(h('div', { id: 'toasts', 'aria-live': 'polite' }));
  const el = h('div', { class: `toast toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, msg);
  box.append(el);
  setTimeout(() => el.classList.add('out'), 3800);
  setTimeout(() => el.remove(), 4300);
}
export function errorText(e) {
  if (e?.details && typeof e.details === 'object') return `${e.message} — ${Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(', ')}`;
  return e?.message || String(e);
}
export async function guard(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(errorText(e), 'error'); throw e; }
}

// ───────── Modal / sheet (full-screen on phones) ─────────
export function modal(title, body, { wide = false, onClose } = {}) {
  const close = () => { back.remove(); document.body.classList.remove('modal-open'); onClose?.(); };
  const panel = h('div', { class: `modal ${wide ? 'modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'modal-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': t('close'), onclick: close }, '✕')),
    h('div', { class: 'modal-body' }, body));
  const back = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === back) close(); } }, panel);
  document.body.append(back);
  document.body.classList.add('modal-open');
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  setTimeout(() => panel.querySelector('input,select,textarea,button:not(.icon-btn)')?.focus(), 30);
  return { close, panel };
}
export function confirmBox(message) {
  return new Promise((resolve) => {
    let m;
    const ok = h('button', { class: 'btn btn-danger', onclick: () => { m.close(); resolve(true); } }, t('confirm'));
    m = modal(t('confirm'), [h('p', {}, message), h('div', { class: 'form-actions' }, h('button', { class: 'btn', onclick: () => { m.close(); resolve(false); } }, t('cancel')), ok)], { onClose: () => resolve(false) });
  });
}
export function promptBox(title, label, { minLength = 0 } = {}) {
  return new Promise((resolve) => {
    let m;
    const ta = h('textarea', { rows: 3, required: minLength > 0 });
    const ok = h('button', { class: 'btn btn-primary', onclick: () => { if (ta.value.trim().length < minLength) { ta.focus(); return; } m.close(); resolve(ta.value.trim()); } }, t('confirm'));
    m = modal(title, [h('label', { class: 'field' }, h('span', {}, label), ta), h('div', { class: 'form-actions' }, h('button', { class: 'btn', onclick: () => { m.close(); resolve(null); } }, t('cancel')), ok)], { onClose: () => resolve(null) });
  });
}

// ───────── Generic form from field definitions ─────────
// field: { key, label:{fr,en,ar}|string, type:'text'|'number'|'date'|'select'|'textarea'|'checkbox', options:[[v,label]], required, step, help, section }
export function buildForm(fields, values = {}, onSubmit, { submitLabel } = {}) {
  const inputs = {};
  const errBox = h('div', { class: 'form-error', role: 'alert' });
  const groups = [];
  let current = null;
  for (const f of fields) {
    if (f.section) { current = h('fieldset', { class: 'form-section' }, h('legend', {}, L(f.section))); groups.push(current); continue; }
    const id = `f_${f.key}_${Math.random().toString(36).slice(2, 7)}`;
    let input;
    const v = values[f.key] ?? f.default ?? '';
    if (f.type === 'select') {
      input = h('select', { id, name: f.key, required: f.required }, !f.required ? h('option', { value: '' }, '—') : null,
        ...(typeof f.options === 'function' ? f.options() : f.options).map(([ov, ol]) => h('option', { value: ov, selected: String(v) === String(ov) }, L(ol))));
    } else if (f.type === 'textarea') input = h('textarea', { id, name: f.key, rows: 3, maxlength: 2000 }, v);
    else if (f.type === 'checkbox') input = h('input', { id, name: f.key, type: 'checkbox', checked: !!Number(v) || v === true });
    else input = h('input', { id, name: f.key, type: f.type || 'text', value: v, required: f.required, step: f.type === 'number' ? (f.step || 'any') : undefined, inputmode: f.type === 'number' ? 'decimal' : undefined, autocomplete: f.autocomplete || 'off', placeholder: f.placeholder || '' });
    inputs[f.key] = input;
    const el = h('label', { class: `field ${f.type === 'checkbox' ? 'field-check' : ''} ${f.full ? 'field-full' : ''}`, for: id },
      h('span', {}, L(f.label), f.required ? h('b', { class: 'req', 'aria-label': t('required') }, ' *') : null), input,
      f.help ? h('small', { class: 'help' }, L(f.help)) : null, h('small', { class: 'field-err' }));
    (current ?? (groups[0]?.tagName === 'DIV' ? groups[0] : (groups.unshift(h('div', { class: 'form-grid' })), groups[0]))).append(el);
  }
  for (const g of groups) if (g.tagName === 'FIELDSET') g.classList.add('form-grid');
  const btn = h('button', { class: 'btn btn-primary', type: 'submit' }, submitLabel || t('save'));
  const form = h('form', { class: 'form', novalidate: true }, ...groups, errBox, h('div', { class: 'form-actions' }, btn));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.textContent = '';
    form.querySelectorAll('.field-err').forEach((x) => (x.textContent = ''));
    const data = {};
    for (const f of fields) {
      if (!f.key) continue;
      const i = inputs[f.key];
      data[f.key] = f.type === 'checkbox' ? (i.checked ? 1 : 0) : i.value.trim() === '' ? null : f.type === 'number' ? Number(i.value.replace(',', '.')) : i.value.trim();
      if (f.required && (data[f.key] === null || data[f.key] === '')) { i.closest('.field').querySelector('.field-err').textContent = t('required'); i.focus(); return; }
    }
    btn.disabled = true;
    try { await onSubmit(data); }
    catch (err) {
      errBox.textContent = err.message;
      if (err.details) for (const [k, msg] of Object.entries(err.details)) { const fe = inputs[k]?.closest('.field')?.querySelector('.field-err'); if (fe) fe.textContent = msg; }
    } finally { btn.disabled = false; }
  });
  return form;
}

// ───────── Responsive table (cards on phones via data-label) ─────────
// cols: [{ key, label, render?(row), num?:bool }]
export function table(cols, rows, { onRow, empty } = {}) {
  if (!rows?.length) return empty ?? emptyState(t('none'));
  return h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, cols.map((c) => h('th', { class: c.num ? 'num' : '' }, L(c.label))))),
    h('tbody', {}, rows.map((r) => h('tr', { class: onRow ? 'clickable' : '', onclick: onRow ? () => onRow(r) : undefined, tabindex: onRow ? 0 : undefined, onkeydown: onRow ? (e) => { if (e.key === 'Enter') onRow(r); } : undefined },
      cols.map((c) => h('td', { class: c.num ? 'num' : '', 'data-label': L(c.label) }, c.render ? c.render(r) : r[c.key] ?? '—')))))));
}

export function emptyState(text, action) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, '◇'), h('p', {}, text), action || null);
}
export const badge = (text, kind = '') => h('span', { class: `badge ${kind ? 'badge-' + kind : ''}` }, text);
export function statusBadge(s) {
  const map = { validated: 'ok', approved: 'ok', active: 'ok', connected: 'ok', succeeded: 'ok', realized: 'ok', committed: 'ok', converted: 'ok',
    pending: 'warn', pending_validation: 'warn', proposed: 'info', negotiating: 'info', more_analysis: 'warn', running: 'info', staged: 'warn', identified: 'info', in_progress: 'info', extracted: 'info', not_tested: 'muted',
    rejected: 'bad', failed: 'bad', error: 'bad', expired: 'muted', superseded: 'muted', disabled: 'muted', critical: 'bad', warning: 'warn', info: 'info' };
  const labels = { fr: { validated: 'validé', approved: 'approuvé', active: 'active', pending: 'en attente', pending_validation: 'à valider', proposed: 'proposé', negotiating: 'en négociation', more_analysis: 'analyse demandée', rejected: 'rejeté', expired: 'expirée', accepted: 'acceptée', not_tested: 'non testé', identified: 'identifiée', in_progress: 'en cours', realized: 'réalisée', staged: 'à valider', committed: 'importé', succeeded: 'réussi', failed: 'échec', running: 'en cours', critical: 'critique', warning: 'attention', info: 'info', superseded: 'remplacé', extracted: 'extrait', converted: 'converti', connected: 'connecté', not_configured: 'connexion requise', disabled: 'désactivé', error: 'erreur' } };
  const lab = getLang() === 'fr' ? labels.fr[s] ?? s : String(s).replace(/_/g, ' ');
  return badge(lab, map[s] || 'muted');
}

// ───────── Charts (inline SVG, no external library) ─────────
const PALETTE = ['#0b6e99', '#e08a1e', '#2f9e6b', '#8a5cc2', '#d1495b', '#5c7080', '#c7a12b', '#3aa7a3', '#9c6644', '#6f8fdc', '#b55d8a', '#7a9a3a', '#444f5a'];
export const color = (i) => PALETTE[i % PALETTE.length];

export function lineChart(series, { height = 220, unit = '', yLabel = '' } = {}) {
  // series: [{ name, points:[{x:'YYYY-MM-DD', y:number}] }]
  const all = series.flatMap((s) => s.points).filter((p) => Number.isFinite(p.y));
  if (all.length < 1) return emptyState(t('none'));
  const W = 640, H = height, P = { l: 56, r: 14, t: 14, b: 30 };
  const xs = [...new Set(all.map((p) => p.x))].sort();
  const ymin0 = Math.min(...all.map((p) => p.y)), ymax0 = Math.max(...all.map((p) => p.y));
  const pad = (ymax0 - ymin0) * 0.12 || Math.abs(ymax0) * 0.1 || 1;
  const ymin = ymin0 - pad, ymax = ymax0 + pad;
  const X = (x) => P.l + (xs.length === 1 ? (W - P.l - P.r) / 2 : (xs.indexOf(x) / (xs.length - 1)) * (W - P.l - P.r));
  const Y = (y) => P.t + (1 - (y - ymin) / (ymax - ymin)) * (H - P.t - P.b);
  const ticks = 4;
  const grid = Array.from({ length: ticks + 1 }, (_, i) => ymin + ((ymax - ymin) * i) / ticks);
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': yLabel || 'graphique' },
    grid.map((g) => [svg('line', { x1: P.l, x2: W - P.r, y1: Y(g), y2: Y(g), class: 'grid' }), svg('text', { x: P.l - 6, y: Y(g) + 4, class: 'axis', 'text-anchor': 'end' }, fmt(g, Math.abs(g) < 10 ? 2 : 0))]),
    xs.filter((_, i) => xs.length <= 6 || i % Math.ceil(xs.length / 6) === 0 || i === xs.length - 1).map((x) => svg('text', { x: X(x), y: H - 8, class: 'axis', 'text-anchor': 'middle' }, dateFmt(x).replace(/\s\d{4}$/, ''))),
    series.map((se, i) => {
      const pts = se.points.filter((p) => Number.isFinite(p.y));
      return [
        svg('polyline', { points: pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' '), fill: 'none', stroke: se.color || color(i), 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),
        pts.map((p) => svg('circle', { cx: X(p.x), cy: Y(p.y), r: 3.5, fill: se.color || color(i) }, svg('title', {}, `${se.name} · ${dateFmt(p.x)} · ${fmt(p.y, 1)} ${unit}`))),
      ];
    }));
  return h('figure', { class: 'chart-fig' }, s, series.length > 1 || series[0]?.name ? h('figcaption', { class: 'legend' }, series.map((se, i) => h('span', {}, h('i', { style: { background: se.color || color(i) } }), se.name))) : null);
}

/** Horizontal stacked bar + ranked list: "where each dinar goes". */
export function breakdownChart(lines, { unit = 'TND/t' } = {}) {
  const pos = lines.filter((l) => l.tnd_t > 0).sort((a, b) => b.tnd_t - a.tnd_t);
  const total = pos.reduce((a, b) => a + b.tnd_t, 0);
  if (!total) return emptyState(t('none'));
  return h('div', { class: 'breakdown' },
    h('div', { class: 'stack', role: 'img', 'aria-label': 'décomposition' }, pos.map((l, i) => h('span', { style: { width: `${(l.tnd_t / total) * 100}%`, background: color(i) }, title: `${l.label}: ${fmt(l.tnd_t, 1)} ${unit}` }))),
    h('ul', { class: 'bd-list' }, pos.map((l, i) => h('li', {}, h('i', { style: { background: color(i) } }), h('span', { class: 'bd-label' }, l.label), h('span', { class: 'bd-val' }, `${fmt(l.tnd_t, 1)} ${unit}`), h('span', { class: 'bd-pct' }, pct((l.tnd_t / total) * 100, 1))))));
}

export function barChart(items, { unit = '', height = 200 } = {}) {
  // items: [{ label, value, highlight }]
  if (!items.length) return emptyState(t('none'));
  const W = 640, H = height, P = { l: 10, r: 10, t: 16, b: 40 };
  const max = Math.max(...items.map((i) => Math.abs(i.value))) || 1;
  const bw = (W - P.l - P.r) / items.length;
  return h('figure', { class: 'chart-fig' }, svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' },
    items.map((it, i) => {
      const bh = (Math.abs(it.value) / max) * (H - P.t - P.b);
      const x = P.l + i * bw + bw * 0.15;
      return [
        svg('rect', { x, y: H - P.b - bh, width: bw * 0.7, height: bh, rx: 4, fill: it.highlight ? '#2f9e6b' : color(0) }, svg('title', {}, `${it.label}: ${fmt(it.value, 1)} ${unit}`)),
        svg('text', { x: x + bw * 0.35, y: H - P.b - bh - 4, class: 'axis', 'text-anchor': 'middle' }, fmt(it.value, 0)),
        svg('text', { x: x + bw * 0.35, y: H - P.b + 14, class: 'axis', 'text-anchor': 'middle' }, String(it.label).slice(0, 14)),
        it.sub ? svg('text', { x: x + bw * 0.35, y: H - P.b + 27, class: 'axis muted', 'text-anchor': 'middle' }, String(it.sub).slice(0, 16)) : null,
      ];
    })));
}

export function kpi(label, value, { sub, kind, onclick } = {}) {
  return h(onclick ? 'button' : 'div', { class: `kpi ${kind ? 'kpi-' + kind : ''}`, onclick, type: onclick ? 'button' : undefined }, h('span', { class: 'kpi-label' }, label), h('strong', { class: 'kpi-value' }, value), sub ? h('span', { class: 'kpi-sub' }, sub) : null);
}

export function card(title, body, { actions, cls = '' } = {}) {
  return h('section', { class: `card ${cls}` }, title ? h('header', { class: 'card-head' }, h('h3', {}, title), actions ? h('div', { class: 'card-actions' }, actions) : null) : null, h('div', { class: 'card-body' }, body));
}

export function tabs(list, active, onChange) {
  return h('div', { class: 'tabs', role: 'tablist' }, list.map(([id, label]) => h('button', { role: 'tab', 'aria-selected': id === active ? 'true' : 'false', class: id === active ? 'active' : '', onclick: () => onChange(id) }, label)));
}

export function qs() { return new URLSearchParams(location.hash.split('?')[1] || ''); }
export function setQs(params) {
  const [path] = location.hash.split('?');
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  for (const [k, v] of Object.entries(params)) v === null ? q.delete(k) : q.set(k, v);
  history.replaceState(null, '', `${path}?${q}`);
}
export function can(perm) {
  const r = session.user?.role;
  return { read: true, write: ['analyst', 'director', 'admin'].includes(r), approve: ['director', 'admin'].includes(r), ai: ['analyst', 'director', 'admin'].includes(r), admin: r === 'admin' }[perm] ?? false;
}
