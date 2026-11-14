import { h, clear, card, fmt, modal, qs, setQs } from './core.js';
import { t, L } from './i18n.js';
import { pageHead } from './shared.js';
import { calcContext } from './live.js';
import { CATEGORIES, CALCULATORS, contextValue } from './calc-defs.js';

const AL = (o) => L(o);

function fmtVal(v) {
  if (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) return '—';
  if (typeof v === 'number') return fmt(v, Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
  return L(v);
}

export function openCalculator(def, ctx) {
  const out = h('div', { class: 'calc-results', 'aria-live': 'polite' });
  const inputs = {};
  const fromData = new Set();
  const fields = def.inputs.map((inp) => {
    const prefill = inp.ctx ? contextValue(inp.ctx, ctx) : null;
    const val = prefill ?? inp.def ?? '';
    if (prefill !== null && prefill !== undefined) fromData.add(inp.key);
    const el = h('input', { type: 'number', inputmode: 'decimal', step: 'any', value: val === null ? '' : val, 'aria-label': L(inp.label) });
    inputs[inp.key] = el;
    return h('label', { class: 'field calc-field' },
      h('span', {}, L(inp.label), inp.unit ? h('small', { class: 'unit' }, ` (${typeof inp.unit === 'string' ? inp.unit : L(inp.unit)})`) : null),
      el,
      fromData.has(inp.key) ? h('small', { class: 'help data' }, '✓ ', AL({ fr: 'pré-rempli depuis vos données — modifiable', en: 'pre-filled from your data — editable', ar: 'من بياناتكم — قابل للتعديل' })) : inp.where ? h('small', { class: 'help' }, L(inp.where)) : null);
  });
  const run = () => {
    const v = Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value.trim() === '' ? null : el.value.replace(',', '.')]));
    let res;
    try { res = def.compute(v, ctx); } catch (e) { out.replaceChildren(h('div', { class: 'lp-verdict warn' }, e.message)); return; }
    if (!res) {
      const missing = def.inputs.filter((i) => !i.def && i.def !== 0 && !v[i.key]).map((i) => L(i.label));
      out.replaceChildren(h('p', { class: 'muted' }, AL({ fr: 'Saisissez : ', en: 'Enter: ', ar: 'أدخل: ' }), missing.join(', ') || '…'));
      return;
    }
    out.replaceChildren(...res.map((x) => h('div', { class: `calc-res ${x.main ? 'main' : ''} ${x.tone || ''}` }, h('span', {}, L(x.label)), h('strong', {}, fmtVal(x.value), x.unit ? h('small', {}, ' ', typeof x.unit === 'string' ? x.unit : L(x.unit)) : null))));
  };
  Object.values(inputs).forEach((el) => el.addEventListener('input', run));
  const needList = h('details', { class: 'calc-need' },
    h('summary', {}, AL({ fr: 'Ce qu’il faut saisir', en: 'What you need', ar: 'ما يجب إدخاله' })),
    h('ul', {}, def.inputs.map((i) => h('li', {}, h('strong', {}, L(i.label)), i.unit ? ` — ${typeof i.unit === 'string' ? i.unit : L(i.unit)}` : '', (i.def === undefined && !i.ctx) ? h('b', { class: 'req' }, ' *') : '', i.where ? h('small', { class: 'muted' }, ` · ${L(i.where)}`) : null))));
  modal(`${def.icon} ${L(def.title)}`, [
    h('p', { class: 'muted' }, L(def.desc)),
    h('div', { class: 'calc-formula' }, h('span', {}, AL({ fr: 'Formule', en: 'Formula', ar: 'المعادلة' })), h('code', {}, def.formula)),
    h('div', { class: 'form-grid calc-grid' }, fields),
    h('div', { class: 'calc-sticky' }, h('div', { class: 'lp-head' }, '⚡ ', AL({ fr: 'Résultat automatique', en: 'Automatic result', ar: 'النتيجة التلقائية' })), out),
    needList,
  ], { wide: true });
  run();
  setTimeout(() => Object.values(inputs).find((el) => !el.value)?.focus(), 60);
}

export async function calcPage(main) {
  const ctx = await calcContext(true).catch(() => null);
  clear(main);
  main.append(pageHead(`🧮 ${AL({ fr: 'Calculatrices', en: 'Calculators', ar: 'الحاسبات' })}`, AL({ fr: 'Toutes les formules de l’usine : choisissez, tapez vos chiffres, le résultat se calcule seul.', en: 'All mill formulas: pick one, type your numbers, the result is computed automatically.', ar: 'كل معادلات المصنع: اختر وأدخل أرقامك والنتيجة تُحسب تلقائيًا.' })));
  const search = h('input', { type: 'search', placeholder: t('search'), 'aria-label': t('search') });
  const wrap = h('div');
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    wrap.replaceChildren(...CATEGORIES.map((c) => {
      const list = CALCULATORS.filter((d) => d.cat === c.id && (!q || [L(d.title), L(d.desc), d.formula].join(' ').toLowerCase().includes(q)));
      if (!list.length) return null;
      return card(`${c.icon} ${L(c.label)}`, h('div', { class: 'calc-tiles' }, list.map((d) => h('button', { class: 'calc-tile', type: 'button', onclick: () => { setQs({ c: d.id }); openCalculator(d, ctx); } },
        h('span', { class: 'calc-icon', 'aria-hidden': 'true' }, d.icon), h('strong', {}, L(d.title)), h('small', {}, L(d.desc))))));
    }));
  };
  search.addEventListener('input', draw);
  main.append(h('div', { class: 'filters' }, search), wrap);
  draw();
  const open = CALCULATORS.find((d) => d.id === qs().get('c'));
  if (open) openCalculator(open, ctx);
}
