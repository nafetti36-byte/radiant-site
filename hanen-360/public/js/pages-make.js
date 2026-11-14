import { h, api, clear, card, table, statusBadge, badge, tnd, pct, fmt, dateFmt, dtFmt, toast, guard, can, tabs, qs, setQs, modal, download, emptyState, lineChart, barChart, breakdownChart, confirmBox, buildForm, kpi } from './core.js';
import { t } from './i18n.js';
import { pageHead, actionBar, openEntityForm, openImport, runAnalysis } from './shared.js';

const autoAdd = (fn) => { if (qs().get('add') === '1') { setQs({ add: null }); setTimeout(fn, 50); } };

// ═════════ Production PM1 & PM2 ═════════
export async function productionPage(main) {
  const rerender = () => productionPage(main);
  const p = qs();
  const params = new URLSearchParams();
  for (const k of ['machine', 'grade', 'from', 'to']) if (p.get(k)) params.set(k, p.get(k));
  const data = await api(`/api/analysis/costing?${params}`);
  clear(main);
  const add = () => openEntityForm('production', { title: `${t('add')} — période de production`, onSaved: rerender });
  main.append(pageHead(t('nav_production'), 'Coût de revient par tonne vendable, pertes, efficacité', actionBar({ onAdd: add, onImport: () => openImport('production', rerender), onAnalyze: () => runAnalysis(rerender), onExport: () => download('/api/export/costing', 'couts.xlsx') })));
  autoAdd(add);

  const fM = h('select', { 'aria-label': 'Machine' }, h('option', { value: '' }, 'PM1 + PM2'), ['PM1', 'PM2'].map((m) => h('option', { value: m, selected: p.get('machine') === m }, m)));
  const fFrom = h('input', { type: 'date', value: p.get('from') || '', 'aria-label': 'Du' });
  const fTo = h('input', { type: 'date', value: p.get('to') || '', 'aria-label': 'Au' });
  const apply = () => { setQs({ machine: fM.value || null, from: fFrom.value || null, to: fTo.value || null }); rerender(); };
  [fM, fFrom, fTo].forEach((x) => x.addEventListener('change', apply));
  main.append(h('div', { class: 'filters' }, fM, fFrom, fTo));

  const periods = data.periods;
  if (!periods.length) { main.append(card(t('guided_setup'), emptyState(t('step_production'), can('write') ? h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', onclick: add }, t('add')), h('button', { class: 'btn', onclick: () => openImport('production', rerender) }, t('import'))) : null))); return; }

  const latest = {};
  for (const x of periods) if (x.result && !latest[x.machine]) latest[x.machine] = x;
  main.append(h('div', { class: 'kpis' }, Object.values(latest).flatMap((x) => [
    kpi(`${x.machine} ${t('kpi_cost_t')}`, tnd(x.result.cost_per_saleable_t, 0), { sub: `${x.product_grade} · ${dateFmt(x.period_end)}` }),
    kpi(`${x.machine} rebuts`, pct(x.result.reject_rate_pct), { sub: `${fmt(x.downtime_h, 0)} h d’arrêt${x.result.availability_pct !== null ? ` · dispo ${pct(x.result.availability_pct)}` : ''}` }),
    kpi(`${x.machine} fibre/t`, x.result.fibre_consumption_t_per_t ? `${fmt(x.result.fibre_consumption_t_per_t, 3)} t/t` : '—', { sub: x.result.fibre_mix_recovered_pct !== null ? `recyclé ${pct(x.result.fibre_mix_recovered_pct)}` : '' }),
  ])));

  const series = ['PM1', 'PM2'].map((m) => ({ name: m, points: periods.filter((x) => x.machine === m && x.result).map((x) => ({ x: x.period_end, y: x.result.cost_per_saleable_t })) })).filter((s) => s.points.length);
  main.append(card(t('cost_trend'), lineChart(series, { unit: 'TND/t' })));
  if (data.variance.length) main.append(h('div', { class: 'grid-2' }, data.variance.map((v) => card(`${v.machine} — ${t('variance')}`, [
    h('p', {}, h('strong', { class: v.delta_t > 0 ? 'bad' : 'pos' }, `${v.delta_t > 0 ? '+' : ''}${fmt(v.delta_t, 1)} TND/t (${pct(v.delta_pct)})`), ` : ${fmt(v.previous_cost_t, 1)} → ${fmt(v.current_cost_t, 1)} TND/t`),
    table([{ key: 'label', label: 'Poste' }, { key: 'previous_t', label: 'Préc.', num: true, render: (d) => fmt(d.previous_t, 1) }, { key: 'current_t', label: 'Actuel', num: true, render: (d) => fmt(d.current_t, 1) }, { key: 'delta_t', label: 'Écart', num: true, render: (d) => h('span', { class: d.delta_t > 0 ? 'bad' : 'pos' }, fmt(d.delta_t, 1)) }], v.drivers),
  ]))));

  main.append(card(t('periods'), table([
    { key: 'machine', label: 'Machine', render: (r) => badge(r.machine, 'info') },
    { key: 'period', label: 'Période', render: (r) => `${dateFmt(r.period_start)} → ${dateFmt(r.period_end)}` },
    { key: 'product_grade', label: 'Grade' },
    { key: 'saleable_t', label: 'Vendable t', num: true, render: (r) => fmt(r.saleable_t, 0) },
    { key: 'cost', label: t('kpi_cost_t'), num: true, render: (r) => (r.result ? h('strong', {}, fmt(r.result.cost_per_saleable_t, 1)) : h('small', { class: 'bad' }, r.error)) },
    { key: 'fibre', label: 'Fibre %', num: true, render: (r) => pct(r.result?.fibre_pct) },
    { key: 'energy', label: 'Énergie %', num: true, render: (r) => pct(r.result?.energy_pct) },
    { key: 'margin', label: t('kpi_margin'), num: true, render: (r) => pct(r.result?.gross_margin_pct) },
    { key: 'src', label: t('source'), render: (r) => h('small', {}, r.source) },
  ], periods, { onRow: (r) => periodDetail(r, rerender) })));
}

function periodDetail(p, rerender) {
  const r = p.result;
  if (!r) return toast(p.error, 'error');
  const m = modal(`${p.machine} · ${p.product_grade} · ${dateFmt(p.period_start)} → ${dateFmt(p.period_end)}`, [
    h('div', { class: 'kpis kpis-sm' },
      kpi(t('kpi_cost_t'), tnd(r.cost_per_saleable_t, 1)), kpi('Coût complet / t', tnd(r.full_cost_per_t, 1)), kpi('Coût variable / t', tnd(r.variable_cost_per_t, 1)),
      kpi(t('break_even'), tnd(r.break_even_price_tnd_t, 0)), kpi(t('target_price'), tnd(r.target_price_tnd_t, 0)),
      kpi(t('kpi_margin'), pct(r.gross_margin_pct), { sub: r.contribution_margin_tnd_t !== null ? `contribution ${tnd(r.contribution_margin_tnd_t, 0)}/t` : '' }),
      kpi('Valeur stock', tnd(r.inventory_value_tnd)), kpi('Coût total', tnd(r.manufacturing_tnd))),
    card(t('where_dinar'), breakdownChart(r.lines)),
    h('div', { class: 'grid-2' },
      card('Ratios', h('dl', { class: 'kv kv-tight' }, [['kWh / t', fmt(r.kwh_per_t, 0)], ['Gaz Nm³ / t', fmt(r.gas_nm3_per_t, 1)], ['Vapeur t / t', fmt(r.steam_t_per_t, 3)], ['Eau m³ / t', fmt(r.water_m3_per_t, 1)], ['Fibre t / t', fmt(r.fibre_consumption_t_per_t, 3)], ['Rebuts', pct(r.reject_rate_pct)], ['Disponibilité', pct(r.availability_pct)]].map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]))),
      card(t('sensitivity'), table([{ key: 'driver', label: 'Facteur' }, { key: 'delta_cost_t', label: 'Δ coût/t', num: true, render: (x) => `${x.delta_cost_t > 0 ? '+' : ''}${fmt(x.delta_cost_t, 1)} TND` }], r.sensitivity))),
    h('div', { class: 'form-actions wrap' },
      h('a', { class: 'btn', href: `#/pricing?period=${p.id}`, onclick: () => m.close() }, t('nav_pricing')),
      can('write') ? h('button', { class: 'btn', onclick: () => { m.close(); openEntityForm('production', { id: p.id, values: p, onSaved: rerender }); } }, t('edit')) : null,
      can('approve') ? h('button', { class: 'btn btn-danger-ghost', onclick: async () => { if (await confirmBox(t('confirm_delete'))) { await guard(() => api(`/api/production/${p.id}`, { method: 'DELETE' })); m.close(); rerender(); } } }, t('delete')) : null),
  ], { wide: true });
}

// ═════════ Energy Intelligence ═════════
export async function energyPage(main) {
  const rerender = () => energyPage(main);
  const e = await api('/api/analysis/energy');
  clear(main);
  main.append(pageHead(t('nav_energy'), 'Électricité, vapeur, cogénération, gaz et eau par tonne vendable', actionBar({ onAdd: () => (location.hash = '#/production?add=1'), onImport: () => openImport('production', rerender), onAnalyze: () => runAnalysis(rerender), onExport: () => download('/api/export/costing', 'energie.xlsx') })));
  const machines = Object.keys(e);
  if (!machines.length) { main.append(card(t('guided_setup'), emptyState('Les indicateurs énergie sont calculés à partir des périodes de production (kWh, gaz, vapeur, eau et tarifs).', h('a', { class: 'btn btn-primary', href: '#/production?add=1' }, t('step_production'))))); return; }
  main.append(h('div', { class: 'kpis' }, machines.flatMap((m) => {
    const l = e[m].latest;
    return [kpi(`${m} énergie / t`, tnd(l.energy_cost_t, 1), { sub: `${pct(l.energy_pct)} du coût · meilleur ${fmt(e[m].best.energy_cost_t, 1)}` }), kpi(`${m} kWh / t`, fmt(l.kwh_t, 0), { sub: `vapeur ${fmt(l.steam_t, 3)} t/t · gaz ${fmt(l.gas_t, 1)} Nm³/t` }), kpi(`${m} gisement`, tnd(e[m].gap_to_best_tnd), { sub: 'vs meilleure période', kind: e[m].gap_to_best_tnd > 0 ? 'info' : 'ok' })];
  })));
  const metric = (k, title, unit) => card(title, lineChart(machines.map((m) => ({ name: m, points: e[m].series.map((s) => ({ x: s.period_end, y: s[k] })) })), { unit }));
  main.append(h('div', { class: 'grid-2' }, metric('energy_cost_t', 'Coût énergie TND / t', 'TND/t'), metric('kwh_t', 'Électricité kWh / t', 'kWh/t'), metric('steam_t', 'Vapeur t / t', 't/t'), metric('gas_t', 'Gaz Nm³ / t', 'Nm³/t'), metric('water_t', 'Eau m³ / t', 'm³/t'), metric('reject_pct', 'Rebuts %', '%')));
}

// ═════════ Jumbo Roll Pricing ═════════
export async function pricingPage(main) {
  const rerender = () => pricingPage(main);
  const [costing, sims] = await Promise.all([api('/api/analysis/costing?limit=24'), api('/api/price-simulations')]);
  clear(main);
  main.append(pageHead(t('nav_pricing'), 'Du coût au prix : plancher, point mort, prix cible, compétitivité', actionBar({ onExport: () => download('/api/export/costing', 'prix.xlsx') })));
  const periods = costing.periods.filter((x) => x.result);
  if (!periods.length) { main.append(card(t('guided_setup'), emptyState('La simulation repose sur une période de production validée.', h('a', { class: 'btn btn-primary', href: '#/production?add=1' }, t('step_production'))))); return; }
  const out = h('div', { class: 'sim-out' });
  const pre = Number(qs().get('period')) || periods[0].id;
  const form = buildForm([
    { key: 'period_id', label: 'Période de base', type: 'select', required: true, default: pre, options: periods.map((x) => [x.id, `${x.machine} · ${x.product_grade} · ${x.period_end} · ${fmt(x.result.cost_per_saleable_t, 0)} TND/t`]) },
    { key: 'current_price_tnd_t', label: 'Prix actuel TND/t (vide = prix moyen de la période)', type: 'number' },
    { key: 'proposed_price_tnd_t', label: 'Prix proposé TND/t', type: 'number' },
    { key: 'competitor_price_tnd_t', label: 'Prix concurrent TND/t', type: 'number' },
    { key: 'fibre_price_change_pct', label: 'Variation prix fibre %', type: 'number', default: 0 },
    { key: 'energy_price_change_pct', label: 'Variation prix énergie %', type: 'number', default: 0 },
    { key: 'chemicals_change_pct', label: 'Variation chimie %', type: 'number', default: 0 },
    { key: 'volume_change_pct', label: 'Variation volume %', type: 'number', default: 0 },
    { key: 'target_margin_pct', label: 'Marge cible %', type: 'number' },
    { key: 'name', label: 'Nom (pour enregistrer)', full: true },
  ], {}, async (d) => {
    const r = await api('/api/analysis/price-simulation', { method: 'POST', body: { ...d, save: !!d.name } });
    const tile = (lab, at) => at ? kpi(lab, `${tnd(at.margin_tnd_t, 0)}/t`, { sub: `marge ${pct(at.margin_pct)} · profit ${tnd(at.profit_tnd)}`, kind: at.margin_tnd_t < 0 ? 'bad' : 'ok' }) : null;
    out.replaceChildren(
      h('div', { class: `verdict ${/^REFUS/.test(r.verdict) ? 'bad' : /^RISQUE/.test(r.verdict) ? 'warn' : 'ok'}` }, h('strong', {}, t('verdict')), ' : ', r.verdict),
      h('div', { class: 'kpis kpis-sm' }, kpi(t('floor'), tnd(r.floor_price_short_term_t, 0)), kpi(t('break_even'), tnd(r.break_even_price_t, 0)), kpi(t('target_price'), tnd(r.target_price_t, 0)),
        tile('Au prix actuel', r.at_current_price), tile('Au prix proposé', r.at_proposed_price), tile('Au prix concurrent', r.at_competitor_price),
        r.profit_delta_tnd !== null ? kpi('Δ profit période', tnd(r.profit_delta_tnd), { sub: r.proposed_change_pct !== null ? `${pct(r.proposed_change_pct)} prix` : '', kind: r.profit_delta_tnd < 0 ? 'bad' : 'ok' }) : null),
      barChart([{ label: 'Plancher', value: r.floor_price_short_term_t }, { label: 'Point mort', value: r.break_even_price_t }, { label: 'Cible', value: r.target_price_t, highlight: true }, ...(d.current_price_tnd_t || r.at_current_price ? [{ label: 'Actuel', value: d.current_price_tnd_t || (r.at_current_price ? r.at_current_price.margin_tnd_t + r.full_cost_t : 0) }] : []), ...(d.proposed_price_tnd_t ? [{ label: 'Proposé', value: d.proposed_price_tnd_t }] : []), ...(d.competitor_price_tnd_t ? [{ label: 'Concurrent', value: d.competitor_price_tnd_t }] : [])], { unit: 'TND/t' }),
      r.saved_id ? h('p', { class: 'muted' }, `Simulation #${r.saved_id} enregistrée.`) : null);
    if (r.saved_id) setTimeout(rerender, 1200);
  }, { submitLabel: t('simulate') });
  main.append(h('div', { class: 'grid-2' }, card(t('simulate'), form), card('Résultat', out)));
  main.append(h('p', { class: 'muted small' }, 'Approuver un prix ici ne publie aucun tarif : les prix de vente restent décidés et publiés hors application par la Direction.'));
  main.append(card(t('simulations'), table([
    { key: 'created_at', label: t('date'), render: (s) => dtFmt(s.created_at) }, { key: 'name', label: 'Nom' }, { key: 'machine', label: 'Machine' },
    { key: 'be', label: t('break_even'), num: true, render: (s) => fmt(s.result.break_even_price_t, 0) }, { key: 'tp', label: t('target_price'), num: true, render: (s) => fmt(s.result.target_price_t, 0) },
    { key: 'v', label: t('verdict'), render: (s) => h('small', {}, s.result.verdict) }, { key: 'u', label: 'Par', render: (s) => s.user_name },
  ], sims)));
}

// ═════════ Financial Savings Center ═════════
export async function savingsPage(main) {
  const rerender = () => savingsPage(main);
  const [sum, rows] = await Promise.all([api('/api/analysis/savings'), api(`/api/savings${qs().get('status') ? `?status=${qs().get('status')}` : ''}`)]);
  clear(main);
  const add = () => openEntityForm('savings', { onSaved: rerender });
  main.append(pageHead(t('nav_savings'), 'Opportunités validées, prévisions, budget, réalisé vs prévu', actionBar({ onAdd: add, onAnalyze: () => runAnalysis(rerender), onExport: () => download('/api/export/savings', 'economies.xlsx') })));
  autoAdd(add);
  const tt = sum.totals;
  main.append(h('div', { class: 'kpis' },
    kpi(t('realized'), tnd(tt.realized), { kind: 'ok', sub: sum.annual_target_tnd ? `${pct((tt.realized / sum.annual_target_tnd) * 100, 0)} de l’objectif` : 'objectif annuel non défini (Paramètres)' }),
    kpi(`${t('projected')} (validé)`, tnd(tt.validated_projected)), kpi(`${t('projected')} (total)`, tnd(tt.projected)), kpi(t('annual_target'), tnd(sum.annual_target_tnd))));
  if (tt.validated_projected || tt.realized) main.append(card('Réalisé vs prévu', barChart([{ label: t('projected'), value: tt.validated_projected }, { label: t('realized'), value: tt.realized, highlight: true }, ...(sum.annual_target_tnd ? [{ label: t('annual_target'), value: sum.annual_target_tnd }] : [])], { unit: 'TND' })));
  const fs = h('div', { class: 'filters' }, ['', 'identified', 'validated', 'in_progress', 'realized', 'rejected'].map((s) => h('button', { class: `chip ${(qs().get('status') || '') === s ? 'active' : ''}`, onclick: () => { setQs({ status: s || null }); rerender(); } }, s ? statusBadge(s) : t('all'))));
  main.append(fs, card(null, table([
    { key: 'title', label: 'Opportunité', render: (r) => h('div', {}, h('strong', {}, r.title), r.recommendation_id ? h('small', { class: 'muted block' }, `reco #${r.recommendation_id}`) : null) },
    { key: 'category', label: 'Catégorie' }, { key: 'projected_tnd', label: t('projected'), num: true, render: (r) => tnd(r.projected_tnd) },
    { key: 'realized_tnd', label: t('realized'), num: true, render: (r) => h('span', { class: 'pos' }, tnd(r.realized_tnd)) },
    { key: 'quality_validated', label: t('quality'), render: (r) => (r.quality_validated ? '✓' : '—') }, { key: 'due_date', label: 'Échéance', render: (r) => dateFmt(r.due_date) },
    { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) },
  ], rows, { onRow: can('write') ? (r) => openEntityForm('savings', { id: r.id, values: r, onSaved: rerender }) : undefined, empty: emptyState('Approuvez une recommandation chiffrée ou ajoutez une opportunité.', can('write') ? h('button', { class: 'btn btn-primary', onclick: add }, t('add')) : null) })));
}

// ═════════ Reports ═════════
export async function reportsPage(main) {
  const rerender = () => reportsPage(main);
  const rows = await api('/api/reports');
  clear(main);
  const gen = async (kind) => { const r = await guard(() => api('/api/reports', { method: 'POST', body: { kind } })); toast(r.label); rerender(); };
  main.append(pageHead(t('nav_reports'), 'Rapports quotidiens et hebdomadaires générés à partir des seules données validées', h('div', { class: 'action-bar' },
    can('write') ? h('button', { class: 'btn btn-primary', onclick: () => gen('daily') }, t('generate'), ' — jour') : null,
    can('write') ? h('button', { class: 'btn', onclick: () => gen('weekly') }, t('generate'), ' — semaine') : null)));
  main.append(card(null, table([
    { key: 'created_at', label: t('date'), render: (r) => dtFmt(r.created_at) }, { key: 'period_label', label: 'Rapport' }, { key: 'kind', label: 'Type', render: (r) => badge(r.kind, 'info') }, { key: 'created_by', label: 'Origine' },
    { key: 'dl', label: t('export'), render: (r) => h('div', { class: 'row' }, h('button', { class: 'btn btn-sm', onclick: (e) => { e.stopPropagation(); download(`/api/reports/${r.id}?format=pdf`, 'rapport.pdf'); } }, 'PDF'), h('button', { class: 'btn btn-sm', onclick: (e) => { e.stopPropagation(); download(`/api/reports/${r.id}?format=xlsx`, 'rapport.xlsx'); } }, 'Excel')) },
  ], rows, { empty: emptyState('Aucun rapport. Le rapport quotidien est généré automatiquement chaque matin.', can('write') ? h('button', { class: 'btn btn-primary', onclick: () => gen('daily') }, t('generate')) : null) })));
}
