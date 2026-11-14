import { h, api, clear, card, table, statusBadge, badge, tnd, pct, fmt, dateFmt, toast, guard, can, tabs, qs, setQs, modal, download, emptyState, lineChart, barChart, breakdownChart, confirmBox, promptBox, buildForm, kpi } from './core.js';
import { t, L } from './i18n.js';
import { pageHead, actionBar, openEntityForm, openImport, runAnalysis, money, suppliersOptions, GRADES_REC, CURRENCIES } from './shared.js';
import { calcContext, renderOfferPreview } from './live.js';

const autoAdd = (fn) => { if (qs().get('add') === '1') { setQs({ add: null }); setTimeout(fn, 50); } };

// ═════════ Achats & Fournisseurs ═════════
export async function purchasingPage(main) {
  const tab = qs().get('tab') || 'suppliers';
  const rerender = () => purchasingPage(main);
  clear(main);
  const addFor = { suppliers: () => openEntityForm('suppliers', { onSaved: rerender }), offers: () => openEntityForm('offers', { onSaved: rerender }), comparison: () => openEntityForm('offers', { onSaved: rerender }), inbound: () => uploadPdf(rerender) };
  main.append(pageHead(t('nav_purchasing'), 'Fournisseurs, offres, négociations, cotations et décisions d’achat', actionBar({
    onAdd: addFor[tab], onImport: () => openImport(tab === 'suppliers' ? 'suppliers' : 'offers', rerender), onAnalyze: () => runAnalysis(rerender),
    onExport: () => download(`/api/export/${tab === 'suppliers' ? 'suppliers' : 'fibre_analysis'}`, 'export.xlsx'),
  })));
  main.append(tabs([['suppliers', t('suppliers')], ['offers', t('offers')], ['comparison', t('comparison')], ['inbound', t('inbound')]], tab, (x) => { setQs({ tab: x }); rerender(); }));
  const body = h('div', { class: 'tab-body' });
  main.append(body);
  autoAdd(addFor[tab]);
  if (tab === 'suppliers') return suppliersTab(body, rerender);
  if (tab === 'offers') return offersTab(body, rerender, {});
  if (tab === 'comparison') return comparisonTab(body);
  return inboundTab(body, rerender);
}

async function suppliersTab(body, rerender) {
  const q = h('input', { type: 'search', placeholder: t('search'), value: qs().get('q') || '', 'aria-label': t('search') });
  const list = h('div');
  const load = async () => {
    const rows = await api(`/api/suppliers?q=${encodeURIComponent(q.value)}`);
    list.replaceChildren(table([
      { key: 'name', label: { fr: 'Fournisseur', en: 'Supplier', ar: 'المورد' }, render: (r) => h('strong', {}, r.name) },
      { key: 'country', label: { fr: 'Pays', en: 'Country', ar: 'البلد' } },
      { key: 'categories', label: { fr: 'Catégories', en: 'Categories', ar: 'الفئات' } },
      { key: 'payment_terms_days', label: { fr: 'Paiement (j)', en: 'Payment (d)', ar: 'الدفع' }, num: true },
      { key: 'quality_rating', label: t('quality'), num: true, render: (r) => (r.quality_rating ? '★'.repeat(Math.round(r.quality_rating)) : '—') },
      { key: 'active', label: t('status'), render: (r) => statusBadge(r.active ? 'active' : 'disabled') },
    ], rows, { onRow: (r) => supplierDetail(r, rerender), empty: emptyState(t('step_suppliers'), can('write') ? h('button', { class: 'btn btn-primary', onclick: () => openEntityForm('suppliers', { onSaved: rerender }) }, t('add')) : null) }));
  };
  q.addEventListener('input', () => { clearTimeout(q._t); q._t = setTimeout(load, 250); });
  body.append(h('div', { class: 'filters' }, q), list);
  await load();
}

async function supplierDetail(s, rerender) {
  const offers = await api(`/api/offers?supplier_id=${s.id}`);
  const m = modal(s.name, [
    h('dl', { class: 'kv' }, [['Contact', s.contact_name], ['Email', s.contact_email], ['Tél.', s.contact_phone], ['Incoterm', s.incoterm], ['Paiement', s.payment_terms_days ? `${s.payment_terms_days} j` : null], ['Fiabilité', s.reliability_rating], ['Notes', s.notes]].map(([k, v]) => [h('dt', {}, k), h('dd', {}, v ?? '—')])),
    h('h3', {}, `${t('offers')} (${offers.length})`),
    table([{ key: 'offer_date', label: t('date'), render: (r) => dateFmt(r.offer_date) }, { key: 'grade', label: 'Grade' }, { key: 'price', label: 'Prix', num: true, render: (r) => money(r.price, r.currency) }, { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) }], offers),
    can('write') ? h('div', { class: 'form-actions' },
      can('approve') ? h('button', { class: 'btn btn-danger-ghost', onclick: async () => { if (await confirmBox(t('confirm_delete'))) { await guard(() => api(`/api/suppliers/${s.id}`, { method: 'DELETE' })); m.close(); rerender(); } } }, t('delete')) : null,
      h('button', { class: 'btn', onclick: () => { m.close(); openEntityForm('offers', { values: { supplier_id: s.id }, onSaved: rerender }); } }, `＋ ${t('offers')}`),
      h('button', { class: 'btn btn-primary', onclick: () => { m.close(); openEntityForm('suppliers', { id: s.id, values: s, onSaved: rerender }); } }, t('edit'))) : null,
  ], { wide: true });
}

/** Offers enriched by the pricing engine. */
export async function offersTab(body, rerender, { category, grade } = {}) {
  const [an] = await Promise.all([api(`/api/analysis/fibre?all=1${grade ? `&grade=${grade}` : ''}`)]);
  let rows = an.offers;
  if (category) rows = rows.filter((o) => o.category === category);
  const fStatus = h('select', { 'aria-label': t('status') }, h('option', { value: '' }, t('all')), ['active', 'negotiating', 'pending_validation', 'accepted', 'rejected', 'expired'].map((s) => h('option', { value: s }, s)));
  const fGrade = h('select', { 'aria-label': 'Grade' }, h('option', { value: '' }, 'Grade'), [...new Set(rows.map((r) => r.grade))].map((g) => h('option', { value: g }, g)));
  const list = h('div');
  const draw = () => {
    const vis = rows.filter((r) => (!fStatus.value || r.status === fStatus.value) && (!fGrade.value || r.grade === fGrade.value));
    list.replaceChildren(table([
      { key: 'supplier_name', label: { fr: 'Fournisseur', en: 'Supplier', ar: 'المورد' }, render: (r) => h('div', {}, h('strong', {}, r.supplier_name), h('small', { class: 'muted block' }, `#${r.id} · ${dateFmt(r.offer_date)}`)) },
      { key: 'grade', label: 'Grade', render: (r) => badge(r.grade, r.category === 'recovered' ? 'info' : 'muted') },
      { key: 'price', label: { fr: 'Prix nominal', en: 'Nominal price', ar: 'السعر' }, num: true, render: (r) => money(r.price, r.currency) },
      { key: 'eff', label: t('effective_cost'), num: true, render: (r) => r.cost ? h('strong', {}, `${fmt(r.cost.effective_tnd_per_usable_t, 0)}`) : h('small', { class: 'bad' }, r.error) },
      { key: 'ceil', label: t('ceiling'), num: true, render: (r) => r.negotiation ? money(r.negotiation.max_price, r.currency) : h('small', { class: 'muted' }, r.missing || '—') },
      { key: 'target', label: t('target'), num: true, render: (r) => r.negotiation ? money(r.negotiation.target_price, r.currency) : '—' },
      { key: 'sav', label: t('savings_exp'), num: true, render: (r) => r.negotiation ? h('span', { class: 'pos' }, r.negotiation.expected_savings_tnd ? tnd(r.negotiation.expected_savings_tnd) : `${fmt(r.negotiation.expected_savings_tnd_t, 1)} TND/t`) : '—' },
      { key: 'flags', label: t('status'), render: (r) => h('div', { class: 'flags' }, statusBadge(r.status), r.validation_status !== 'validated' ? statusBadge(r.validation_status) : null, r.negotiation?.above_ceiling && r.category === 'recovered' ? badge(t('above_ceiling'), 'bad') : null, r.category === 'recovered' && r.quality_status !== 'approved' ? badge(`${t('quality')}: ${r.quality_status}`, 'warn') : null, r.ceiling_exception ? badge('exception', 'warn') : null) },
    ], vis, { onRow: (r) => offerDetail(r, rerender), empty: emptyState(t('step_offers'), can('write') ? h('button', { class: 'btn btn-primary', onclick: () => openEntityForm('offers', { category, onSaved: rerender }) }, t('add')) : null) }));
  };
  fStatus.onchange = draw; fGrade.onchange = draw;
  body.append(an.warnings.length ? h('div', { class: 'notice notice-warn' }, an.warnings.join(' · ')) : null, h('div', { class: 'filters' }, fGrade, fStatus), list);
  draw();
}

async function offerDetail(o, rerender) {
  const nego = await api(`/api/offers/${o.id}/negotiations`);
  const sections = [];
  sections.push(h('div', { class: 'kpis kpis-sm' },
    kpi(t('effective_cost'), o.cost ? `${fmt(o.cost.effective_tnd_per_usable_t, 1)} ${t('per_usable_t')}` : '—', { sub: o.cost ? `${t('yield')} ${pct(o.cost.usable_yield * 100, 2)}` : o.error }),
    kpi(t('ceiling'), o.negotiation ? money(o.negotiation.max_price, o.currency) : '—', { sub: o.ceiling ? (o.ceiling.ceiling_rule === 'vp_nominal_cap' ? 'plafond = référence pâte vierge (règle)' : 'parité coût effectif') : '', kind: o.negotiation?.above_ceiling ? 'bad' : '' }),
    kpi(t('target'), o.negotiation ? money(o.negotiation.target_price, o.currency) : '—', { sub: o.negotiation?.rationale }),
    kpi(t('savings_exp'), o.negotiation ? (o.negotiation.expected_savings_tnd ? tnd(o.negotiation.expected_savings_tnd) : `${fmt(o.negotiation.expected_savings_tnd_t, 1)} TND/t`) : '—', { kind: 'ok' })));
  if (o.cost) sections.push(card('Formule du coût effectif', [h('code', { class: 'formula' }, o.cost.formula), breakdownChart(o.cost.breakdown.map((b) => ({ label: b.label, tnd_t: b.tnd_t })))]));
  if (o.ceiling) sections.push(card('Plafond d’achat', [h('code', { class: 'formula' }, o.ceiling.formula), h('p', { class: 'small' }, `Référence : ${o.reference.source} — ${fmt(o.reference.effective_tnd, 1)} TND/t utile × équivalence ${o.quality_equivalence_pct} %. Plafond économique ${money(o.ceiling.economic_ceiling, o.currency)} · plafond règle pâte vierge ${money(o.ceiling.vp_nominal_cap, o.currency)}.`), h('p', { class: 'small' }, o.quality_gate)]));
  if (o.missing) sections.push(h('div', { class: 'notice notice-warn' }, o.missing));
  sections.push(h('dl', { class: 'kv' }, [['Incoterm', o.incoterm], ['Quantité', o.quantity_t ? `${fmt(o.quantity_t)} t` : null], ['Validité', o.valid_until ? dateFmt(o.valid_until) : null], ['Taux', o.fx_tnd ? `1 ${o.currency} = ${o.fx_tnd} TND (${dateFmt(o.fx_date)})` : null], ['Humidité / contaminants / pertes', `${o.moisture_pct} % / ${o.contamination_pct} % / ${o.process_loss_pct} %`], ['Source', `${o.source}${o.source_ref ? ' · ' + o.source_ref : ''}`], ['Qualité', `${o.quality_status}${o.quality_notes ? ' — ' + o.quality_notes : ''}`], ['Exception plafond', o.ceiling_exception ? o.ceiling_exception_note : 'non']].map(([k, v]) => [h('dt', {}, k), h('dd', {}, v ?? '—')])));
  sections.push(h('h3', {}, t('negotiation')));
  sections.push(nego.length ? h('ol', { class: 'timeline' }, nego.map((n) => h('li', {}, h('strong', {}, `${dateFmt(n.event_date)} · ${n.kind}`), n.price ? ` — ${money(n.price, o.currency)}` : '', h('p', {}, n.note || ''), h('small', { class: 'muted' }, n.user_name || '')))) : h('p', { class: 'muted' }, '—'));
  const actions = h('div', { class: 'form-actions wrap' });
  if (can('write')) {
    if (o.validation_status !== 'validated' || o.status === 'pending_validation') actions.append(h('button', { class: 'btn btn-primary', onclick: async () => { await guard(() => api(`/api/offers/${o.id}/validate`, { method: 'POST', body: { decision: 'validate' } }), t('saved')); m.close(); rerender(); } }, t('validate')));
    actions.append(h('button', { class: 'btn', onclick: () => {
      let mm; mm = modal(t('negotiation'), buildForm([
        { key: 'event_date', label: t('date'), type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
        { key: 'kind', label: 'Type', type: 'select', required: true, options: [['counter_offer', 'Contre-offre Azur Papier'], ['supplier_reply', 'Réponse fournisseur'], ['note', 'Note'], ['decision', 'Décision']] },
        { key: 'price', label: `Prix (${o.currency}/t)`, type: 'number', default: o.negotiation ? Math.round(o.negotiation.target_price * 100) / 100 : '' },
        { key: 'note', label: 'Note', type: 'textarea', full: true },
      ], {}, async (d) => { await api(`/api/offers/${o.id}/negotiations`, { method: 'POST', body: d }); mm.close(); m.close(); toast(t('saved')); rerender(); }));
    } }, `＋ ${t('negotiation')}`));
    actions.append(h('button', { class: 'btn', onclick: async () => {
      const st = await new Promise((res) => { let q; q = modal(t('quality'), h('div', { class: 'form-actions wrap' }, ['approved', 'pending', 'rejected', 'not_tested'].map((s) => h('button', { class: 'btn', onclick: () => { q.close(); res(s); } }, statusBadge(s)))), { onClose: () => res(null) }); });
      if (!st) return;
      const note = await promptBox(t('quality'), 'Résultats d’essai (blancheur, résistance, douceur…)');
      await guard(() => api(`/api/offers/${o.id}/quality`, { method: 'POST', body: { quality_status: st, quality_notes: note || '' } }), t('saved')); m.close(); rerender();
    } }, t('quality')));
    actions.append(h('button', { class: 'btn', onclick: () => { m.close(); openEntityForm('offers', { id: o.id, values: o, onSaved: rerender }); } }, t('edit')));
  }
  if (can('approve') && o.category === 'recovered') actions.append(h('button', { class: 'btn btn-warn', onclick: async () => {
    if (o.ceiling_exception) { await guard(() => api(`/api/offers/${o.id}/ceiling-exception`, { method: 'POST', body: { authorize: false } }), t('saved')); m.close(); rerender(); return; }
    const note = await promptBox('Exception au plafond pâte vierge', 'Justification de la Direction (obligatoire)', { minLength: 10 });
    if (note) { await guard(() => api(`/api/offers/${o.id}/ceiling-exception`, { method: 'POST', body: { authorize: true, note } }), t('saved')); m.close(); rerender(); }
  } }, o.ceiling_exception ? 'Révoquer l’exception' : 'Autoriser une exception'));
  if (can('approve')) actions.append(h('button', { class: 'btn btn-danger-ghost', onclick: async () => { if (await confirmBox(t('confirm_delete'))) { await guard(() => api(`/api/offers/${o.id}`, { method: 'DELETE' })); m.close(); rerender(); } } }, t('delete')));
  sections.push(actions);
  const m = modal(`${o.supplier_name} — ${o.grade} #${o.id}`, sections, { wide: true });
}

async function comparisonTab(body) {
  const an = await api('/api/analysis/fibre');
  const grades = Object.keys(an.ranking);
  if (!grades.length) { body.append(emptyState(t('step_offers'))); return; }
  for (const g of grades) {
    const r = an.ranking[g];
    body.append(card(`${g} — classement par ${t('effective_cost').toLowerCase()} (${t('per_usable_t')})`, [
      barChart(r.map((x, i) => ({ label: x.supplier, sub: `${fmt(x.price, 0)} ${x.currency}`, value: x.effective_tnd, highlight: i === 0 })), { unit: 'TND/t' }),
      an.references[g] ? h('p', { class: 'small muted' }, `${t('reference')} : ${an.references[g].source}`) : null,
    ]));
  }
  body.append(card('Références pâte vierge utilisées', table([{ key: 'grade', label: 'Grade' }, { key: 'effective_tnd', label: t('effective_cost'), num: true, render: (x) => fmt(x.effective_tnd, 1) }, { key: 'source', label: t('source') }, { key: 'date', label: t('date'), render: (x) => `${dateFmt(x.date)} (${x.age_days} j)` }], Object.values(an.references))));
}

function uploadPdf(rerender) {
  const f = h('input', { type: 'file', accept: 'application/pdf' });
  let m;
  m = modal(t('upload_pdf'), [h('p', { class: 'muted' }, 'L’IA extrait le fournisseur, le grade, le prix et les conditions. Rien n’est enregistré comme offre sans votre validation.'), h('label', { class: 'field' }, h('span', {}, 'PDF'), f),
    h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-primary', onclick: async (e) => {
      if (!f.files[0]) return;
      e.target.disabled = true; e.target.textContent = t('ai_thinking');
      const fd = new FormData(); fd.append('file', f.files[0]);
      try { await api('/api/inbound/pdf', { method: 'POST', form: fd }); m.close(); toast('✓'); setQs({ tab: 'inbound' }); rerender(); }
      catch (x) { toast(x.message, 'error'); e.target.disabled = false; e.target.textContent = t('import'); }
    } }, t('import')))]);
}

async function inboundTab(body, rerender) {
  const rows = await api('/api/inbound');
  body.append(h('div', { class: 'notice' }, 'Sources : PDF importés et emails de fournisseurs autorisés (Cloudflare Email Routing). Chaque cotation reste un brouillon jusqu’à validation.'),
    can('write') ? h('div', { class: 'filters' }, h('button', { class: 'btn btn-primary', onclick: () => uploadPdf(rerender) }, '⤒ ', t('upload_pdf'))) : null);
  body.append(table([
    { key: 'received_at', label: t('date'), render: (r) => dateFmt(r.received_at) },
    { key: 'channel', label: 'Canal', render: (r) => r.channel === 'email' ? `✉ ${r.sender}` : `📄 ${r.filename}` },
    { key: 'subject', label: 'Objet / extrait', render: (r) => r.extracted ? `${r.extracted.supplier_name || '?'} — ${(r.extracted.offers || []).map((x) => `${x.grade} ${x.price} ${x.currency}`).join(', ')}` : r.subject || '—' },
    { key: 'status', label: t('status'), render: (r) => statusBadge(r.status) },
  ], rows, { onRow: (r) => inboundDetail(r, rerender) }));
}

async function inboundDetail(d, rerender) {
  const sups = await suppliersOptions(true);
  const offers = d.extracted?.offers || [];
  const parts = [h('pre', { class: 'small pre-wrap' }, d.excerpt || '')];
  if (d.status === 'pending' && d.channel === 'email' && can('write')) parts.push(h('button', { class: 'btn', onclick: async () => { await guard(() => api(`/api/inbound/${d.id}/extract`, { method: 'POST' })); m.close(); rerender(); } }, 'Extraire avec l’IA'));
  offers.forEach((o, i) => {
    const match = sups.find(([, n]) => n.toLowerCase() === String(d.extracted.supplier_name || '').toLowerCase());
    window.__supplierOpts = sups;
    parts.push(card(`Brouillon ${i + 1} — « ${o.source_quote} »`, d.status === 'converted' ? h('p', {}, `→ offre #${d.offer_id}`) : buildForm([
      { key: 'supplier_id', label: 'Fournisseur', type: 'select', required: true, options: () => sups },
      { key: 'category', label: 'Catégorie', type: 'select', required: true, options: [['virgin_pulp', 'Pâte vierge'], ['recovered', 'Recyclé']] },
      { key: 'grade', label: 'Grade', required: true }, { key: 'offer_date', label: t('date'), type: 'date', required: true },
      { key: 'valid_until', label: 'Validité', type: 'date' }, { key: 'price', label: 'Prix/t', type: 'number', required: true },
      { key: 'currency', label: 'Devise', type: 'select', required: true, options: CURRENCIES.map((c) => [c, c]) }, { key: 'incoterm', label: 'Incoterm' },
      { key: 'quantity_t', label: 'Quantité t', type: 'number' }, { key: 'payment_terms_days', label: 'Paiement j', type: 'number' },
      { key: 'moisture_pct', label: 'Humidité %', type: 'number' }, { key: 'contamination_pct', label: 'Contaminants %', type: 'number' },
      { key: 'freight_tnd_t', label: 'Fret TND/t', type: 'number' }, { key: 'process_loss_pct', label: 'Pertes process %', type: 'number' },
    ], { ...o, supplier_id: match?.[0], offer_date: o.offer_date || new Date().toISOString().slice(0, 10), moisture_pct: o.moisture_pct ?? 10, currency: (o.currency || '').toUpperCase() }, async (data) => {
      const r = await api(`/api/inbound/${d.id}/convert`, { method: 'POST', body: data }); m.close(); toast(`Offre #${r.offer_id} ✓`); rerender();
    }, { submitLabel: t('convert') })));
  });
  if (can('write') && d.status !== 'converted' && d.status !== 'rejected') parts.push(h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-danger-ghost', onclick: async () => { await guard(() => api(`/api/inbound/${d.id}/reject`, { method: 'POST' })); m.close(); rerender(); } }, t('reject'))));
  const m = modal(d.subject || d.filename || `Document #${d.id}`, parts, { wide: true });
}

// ═════════ Virgin Pulp Intelligence ═════════
export async function pulpPage(main) {
  const rerender = () => pulpPage(main);
  const [mk, an] = await Promise.all([api('/api/analysis/market?days=730'), api('/api/analysis/fibre')]);
  clear(main);
  const add = () => openEntityForm('market_prices', { category: 'virgin_pulp', title: `${t('add')} — ${t('market_prices')}`, onSaved: rerender });
  main.append(pageHead(t('nav_pulp'), 'Historique de prix, tendance, coût rendu, rendement et recommandations d’achat', actionBar({
    onAdd: add, onImport: () => openImport('market_prices', rerender), onAnalyze: () => runAnalysis(rerender), onExport: () => download('/api/export/market_prices', 'prix.xlsx'),
    extra: can('write') ? h('button', { class: 'btn', onclick: () => openEntityForm('offers', { category: 'virgin_pulp', onSaved: rerender }) }, `＋ ${t('offers')}`) : null,
  })));
  autoAdd(add);
  const vpGrades = Object.keys(mk.series).filter((g) => !GRADES_REC.includes(g));
  const k = h('div', { class: 'kpis' });
  for (const g of vpGrades) {
    const tr = mk.trends[g];
    k.append(kpi(`${g} — ${tr.latest.basis || 'marché'}`, `${fmt(tr.latest.price)} ${tr.latest.currency}/t`, { sub: `${tr.change_pct === null ? '—' : (tr.change_pct > 0 ? '▲ ' : '▼ ') + pct(Math.abs(tr.change_pct))} · ${dateFmt(tr.latest.price_date)} · ${tr.latest.source}`, kind: tr.change_pct < 0 ? 'ok' : tr.change_pct > 0 ? 'bad' : '' }));
  }
  for (const [g, r] of Object.entries(an.references)) k.append(kpi(`${t('reference')} ${g} rendu`, `${fmt(r.effective_tnd, 0)} ${t('per_usable_t')}`, { sub: r.source }));
  main.append(vpGrades.length || Object.keys(an.references).length ? k : card(t('guided_setup'), emptyState(t('step_market'), can('write') ? h('button', { class: 'btn btn-primary', onclick: add }, t('add')) : null)));
  if (vpGrades.length) {
    main.append(card(`${t('trend')} (${t('market_prices')}, TND/t)`, lineChart(vpGrades.map((g) => ({ name: g, points: mk.series[g].filter((p) => p.price_tnd).map((p) => ({ x: p.price_date, y: p.price_tnd })) })), { unit: 'TND/t' })));
    const advice = vpGrades.map((g) => {
      const tr = mk.trends[g];
      if (tr.change_pct === null) return [g, 'Un seul point de prix : ajoutez l’historique pour mesurer la tendance.'];
      if (tr.change_pct <= -2) return [g, `Marché en baisse (${pct(tr.change_pct)}) : négocier ou fractionner les achats ; ré-indexer les plafonds des recyclés.`];
      if (tr.change_pct >= 2) return [g, `Marché en hausse (${pct(tr.change_pct)}) : sécuriser les volumes nécessaires aux prix actuels ; privilégier les fibres recyclées sous plafond.`];
      return [g, 'Marché stable : acheter au besoin en visant la meilleure offre à coût effectif.'];
    });
    main.append(card('Lecture du marché (règle de tendance, à confirmer par Hanen AI)', h('ul', { class: 'list' }, advice.map(([g, a]) => h('li', {}, h('strong', {}, g), h('span', {}, a))))));
  }
  const body = h('div');
  main.append(card(`${t('offers')} — pâte vierge`, body));
  await offersTab(body, rerender, { category: 'virgin_pulp' });
  const prices = await api('/api/market_prices?limit=100');
  main.append(card(t('market_prices'), table([
    { key: 'price_date', label: t('date'), render: (r) => dateFmt(r.price_date) }, { key: 'grade', label: 'Grade' }, { key: 'price', label: 'Prix', num: true, render: (r) => money(r.price, r.currency, 0) },
    { key: 'basis', label: 'Base' }, { key: 'source', label: t('source'), render: (r) => `${r.source} (${r.source_type})` }, { key: 'validation_status', label: t('status'), render: (r) => statusBadge(r.validation_status) },
  ], prices, { onRow: can('write') ? (r) => openEntityForm('market_prices', { id: r.id, values: r, onSaved: rerender }) : undefined })));
}

// ═════════ Recovered Paper Intelligence ═════════
export async function recoveredPage(main) {
  const rerender = () => recoveredPage(main);
  const [an, settings] = await Promise.all([api('/api/analysis/fibre'), api('/api/settings')]);
  clear(main);
  const add = () => openEntityForm('offers', { category: 'recovered', onSaved: rerender });
  main.append(pageHead(t('nav_recovered'), 'Plafonds d’achat SWL / HWS / SOP, coût fibre utile, classement fournisseurs', actionBar({ onAdd: add, onImport: () => openImport('offers', rerender), onAnalyze: () => runAnalysis(rerender), onExport: () => download('/api/export/fibre_analysis', 'fibres.xlsx') })));
  autoAdd(add);
  const s = settings.values;
  const grid = h('div', { class: 'grid-3' });
  for (const g of GRADES_REC) {
    const refG = s[`vp_reference_${g}`];
    const ref = an.references[refG];
    const offers = an.offers.filter((o) => o.grade === g && o.negotiation && o.validation_status === 'validated');
    const best = an.ranking[g]?.[0];
    grid.append(card(g, [
      h('dl', { class: 'kv kv-tight' },
        h('dt', {}, t('reference')), h('dd', {}, ref ? `${refG} ${fmt(ref.effective_tnd, 0)} ${t('per_usable_t')}` : h('a', { class: 'bad', href: '#/pulp?add=1' }, `${refG} : référence manquante — ajouter un prix`)),
        h('dt', {}, 'Équivalence qualité'), h('dd', {}, `${s[`quality_equivalence_${g}`]} % `, h('small', { class: 'muted' }, `(${t('hypothesis')})`)),
        h('dt', {}, 'Meilleure offre'), h('dd', {}, best ? `${best.supplier} — ${fmt(best.effective_tnd, 0)} ${t('per_usable_t')}` : '—'),
        h('dt', {}, 'Plafond (meilleure offre)'), h('dd', {}, offers[0] ? money(offers.sort((a, b) => a.cost.effective_tnd_per_usable_t - b.cost.effective_tnd_per_usable_t)[0].negotiation.max_price, offers[0].currency) : '—')),
    ]));
  }
  main.append(grid);
  main.append(card(t('calculator'), calculator()));
  const body = h('div');
  main.append(card(`${t('offers')} — papiers recyclés`, body));
  await offersTab(body, rerender, { category: 'recovered' });
}

function calculator() {
  const out = h('div', { class: 'live-preview' });
  let ctx = null;
  const form = buildForm([
    { key: 'grade', label: 'Grade', type: 'select', required: true, options: GRADES_REC.map((g) => [g, g]) },
    { key: 'price', label: 'Prix proposé / t', type: 'number', required: true }, { key: 'currency', label: 'Devise', type: 'select', required: true, options: CURRENCIES.map((c) => [c, c]), default: 'TND' },
    { key: 'quantity_t', label: 'Quantité t', type: 'number' }, { key: 'moisture_pct', label: 'Humidité %', type: 'number', default: 10 }, { key: 'contamination_pct', label: 'Contaminants %', type: 'number' },
    { key: 'process_loss_pct', label: 'Pertes process %', type: 'number' }, { key: 'freight_tnd_t', label: 'Fret TND/t', type: 'number' }, { key: 'processing_tnd_t', label: 'Tri/désencrage TND/t', type: 'number' },
    { key: 'energy_extra_tnd_t', label: 'Énergie incr. TND/t', type: 'number' }, { key: 'chemicals_extra_tnd_t', label: 'Chimie incr. TND/t', type: 'number' }, { key: 'payment_terms_days', label: 'Paiement j', type: 'number' },
  ], {}, async () => {}, { hideSubmit: true, onInput: async (d) => { ctx ||= await calcContext(); renderOfferPreview(out, { ...d, category: 'recovered' }, ctx); } });
  return h('div', {}, h('p', { class: 'muted small' }, 'Tapez un prix : plafond, cible et économie s’affichent instantanément.'), form, out);
}
