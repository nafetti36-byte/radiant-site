import { h, api, session, clear, kpi, card, tnd, pct, fmt, lineChart, breakdownChart, statusBadge, table, emptyState, dateFmt, dtFmt, toast, guard, can, tabs, qs, setQs, promptBox, download, badge } from './core.js';
import { t, L, getLang } from './i18n.js';
import { pageHead, actionBar, runAnalysis, openImport, openEntityForm } from './shared.js';

// ═════════ Tableau de Direction ═════════
export async function dashboardPage(main) {
  const d = await api('/api/dashboard');
  const rerender = () => dashboardPage(main);
  clear(main);
  main.append(pageHead(t('nav_dashboard'), `${t('welcome')}, ${session.user?.name || ''}`, actionBar({
    onAdd: () => (location.hash = d.counts.suppliers ? '#/purchasing?tab=offers&add=1' : '#/purchasing?add=1'),
    onImport: () => openImport(null, rerender),
    onAnalyze: () => runAnalysis(rerender),
    onExport: async () => { const r = await guard(() => api('/api/reports', { method: 'POST', body: { kind: 'adhoc' } })); download(`/api/reports/${r.id}?format=pdf`, 'rapport.pdf'); },
  })));

  const quick = (ico, title, sub, fn) => h('button', { class: 'quick-btn', type: 'button', onclick: fn }, h('span', { class: 'ico', 'aria-hidden': 'true' }, ico), h('strong', {}, title), h('small', {}, sub));
  if (can('write')) {
    const fxAuto = async () => {
      const r = await api('/api/admin/connectors/fx', { method: 'POST', body: { enabled: true, test: true } }).catch((e) => ({ ok: false, error: e.message }));
      if (r.ok) { toast(`Taux mis à jour : ${r.output.saved.map((x) => `${x.currency} ${x.rate_tnd}`).join(' · ')} — automatique chaque matin`); rerender(); }
      else toast(r.error || 'Échec', 'error');
    };
    const noFx = !d.fx || Object.keys(d.fx).filter((k) => k !== 'TND').length === 0;
    main.append(card('⚡ Saisie rapide — les calculs se font seuls', h('div', { class: 'quick-grid' },
      quick('⇄', 'Offre fournisseur', 'Prix → plafond, cible, économie', () => (d.counts.suppliers ? openEntityForm('offers', { onSaved: rerender }) : openEntityForm('suppliers', { title: 'D’abord : nouveau fournisseur', onSaved: rerender }))),
      quick('⚙', 'Période PM1 / PM2', 'Tonnes & coûts → coût/t, marge', () => openEntityForm('production', { title: 'Nouvelle période de production', onSaved: rerender })),
      quick('❋', 'Prix marché pâte', 'Référence BEKP / NBSK', () => openEntityForm('market_prices', { category: 'virgin_pulp', title: 'Prix marché pâte vierge', onSaved: rerender })),
      can('admin') && noFx ? quick('€', 'Activer les taux auto', 'EUR/USD → TND chaque matin', fxAuto)
        : quick('€', 'Taux de change', noFx ? 'EUR/USD → TND' : `EUR ${d.fx.EUR?.rate ?? '—'} · USD ${d.fx.USD?.rate ?? '—'}`, () => (can('admin') ? fxAuto() : openEntityForm('fx_rates', { title: 'Taux de change', onSaved: rerender })))),
    ));
  }

  if (!d.setup_complete) {
    const labels = { fx: t('step_fx'), suppliers: t('step_suppliers'), market: t('step_market'), offers: t('step_offers'), production: t('step_production') };
    main.append(card(t('guided_setup'), [
      h('p', { class: 'muted' }, t('setup_intro')),
      h('ol', { class: 'setup-steps' }, d.setup.map((s, i) => h('li', { class: s.done ? 'done' : '' },
        h('span', { class: 'step-n', 'aria-hidden': 'true' }, s.done ? '✓' : String(i + 1)), h('span', { class: 'step-l' }, labels[s.key]),
        s.done ? badge(t('done'), 'ok') : h('a', { class: 'btn btn-primary btn-sm', href: s.route + (s.route.includes('?') ? '&' : '?') + 'add=1' }, t('do_it'))))),
    ], { cls: 'card-setup' }));
  }

  const m = d.machines;
  const savingsReal = d.savings.totals.realized;
  main.append(h('div', { class: 'kpis' },
    ['PM1', 'PM2'].map((mc) => kpi(`${t('kpi_cost_t')} ${mc}`, m[mc] ? tnd(m[mc].cost_t) : '—', { sub: m[mc] ? `${m[mc].grade} · ${m[mc].period}` : t('step_production'), onclick: () => (location.hash = '#/production') })),
    kpi(t('kpi_nego'), tnd(d.fibre.negotiation_potential_tnd), { sub: d.fibre.above_ceiling ? `${d.fibre.above_ceiling} ${t('above_ceiling').toLowerCase()}` : `${d.counts.offers} ${t('offers').toLowerCase()}`, kind: d.fibre.above_ceiling ? 'bad' : '', onclick: () => (location.hash = '#/recovered') }),
    kpi(t('kpi_savings'), tnd(savingsReal), { sub: d.savings.annual_target_tnd ? `${pct((savingsReal / d.savings.annual_target_tnd) * 100, 0)} / ${tnd(d.savings.annual_target_tnd)}` : `${t('projected')}: ${tnd(d.savings.totals.validated_projected)}`, kind: 'ok', onclick: () => (location.hash = '#/savings') }),
    kpi(t('kpi_decisions'), String(d.counts.pending_decisions), { onclick: () => (location.hash = '#/ai?tab=decisions'), kind: d.counts.pending_decisions ? 'info' : '' }),
    kpi(t('kpi_alerts'), String(d.counts.open_alerts), { kind: d.alerts.some((a) => a.severity === 'critical') ? 'bad' : '' }),
  ));

  const grid = h('div', { class: 'grid-2' });
  for (const mc of ['PM1', 'PM2']) {
    if (!m[mc]) continue;
    grid.append(card(`${t('where_dinar')} — ${mc}`, [
      h('div', { class: 'mini-kpis' },
        h('span', {}, `Fibre ${pct(m[mc].fibre_pct)}`), h('span', {}, `Énergie ${pct(m[mc].energy_pct)}`),
        h('span', {}, `${t('break_even')}: ${tnd(m[mc].break_even_t)}`), m[mc].margin_pct !== null ? h('span', {}, `${t('kpi_margin')} ${pct(m[mc].margin_pct)}`) : null),
      breakdownChart(m[mc].lines),
    ]));
  }
  if (d.cost_trend.length) {
    const series = ['PM1', 'PM2'].map((mc) => ({ name: mc, points: d.cost_trend.filter((p) => p.machine === mc).map((p) => ({ x: p.period_end, y: p.cost_t })) })).filter((s) => s.points.length);
    grid.append(card(t('cost_trend'), lineChart(series, { unit: 'TND/t' })));
  }
  const mk = Object.entries(d.market);
  grid.append(card(t('market'), mk.length ? h('ul', { class: 'list' }, mk.map(([g, x]) => h('li', {}, h('strong', {}, g), h('span', {}, `${fmt(x.price)} ${x.currency}/t`), h('span', { class: x.change_pct < 0 ? 'down' : x.change_pct > 0 ? 'up' : 'muted' }, x.change_pct === null ? '—' : `${x.change_pct > 0 ? '▲' : '▼'} ${pct(Math.abs(x.change_pct))}`), h('small', { class: 'muted' }, `${dateFmt(x.date)} · ${x.source}`)))) : emptyState(t('step_market'), h('a', { class: 'btn btn-primary', href: '#/pulp?add=1' }, t('add'))), { actions: h('a', { href: '#/pulp', class: 'btn btn-link' }, t('see_all')) }));

  grid.append(card(t('decisions'), d.decisions.length ? h('ul', { class: 'list' }, d.decisions.map((r) => h('li', {}, h('a', { href: `#/ai?tab=decisions&id=${r.id}` }, r.title), h('span', { class: 'pos' }, r.savings_tnd ? tnd(r.savings_tnd) : '—')))) : emptyState('—'), { actions: h('a', { href: '#/ai?tab=decisions', class: 'btn btn-link' }, t('see_all')) }));

  grid.append(card(t('alerts'), d.alerts.length ? h('ul', { class: 'list alerts' }, d.alerts.map((a) => h('li', { class: `sev-${a.severity}` }, statusBadge(a.severity), h('span', {}, a.message), can('write') ? h('button', { class: 'btn btn-sm', onclick: async () => { await guard(() => api(`/api/alerts/${a.id}/ack`, { method: 'POST' })); rerender(); } }, t('ack')) : null))) : emptyState('✓')));
  main.append(grid);
  if (d.fibre.warnings.length) main.append(card('⚠', h('ul', {}, d.fibre.warnings.map((w) => h('li', {}, w)))));
}

// ═════════ Hanen AI ═════════
const EXAMPLES = {
  fr: ['Quel est le prix maximum SWL à payer aujourd’hui ?', 'La pâte vierge a baissé de 8 %. Faut-il renégocier les papiers recyclés ?', 'Peut-on baisser le prix du Jumbo Roll de 5 % ?', 'Quel fournisseur offre le coût fibre effectif le plus bas ?', 'Pourquoi le coût par tonne de PM2 a-t-il augmenté ?', 'Comment économiser 100 000 TND sans réduire la qualité ?', 'Faut-il acheter la pâte maintenant ou négocier ?'],
  en: ['What is the maximum SWL price we should pay today?', 'Virgin pulp decreased by 8%. Should we renegotiate recovered paper prices?', 'Can we reduce Jumbo Roll selling price by 5%?', 'Which supplier gives the lowest effective fibre cost?', 'Why did PM2 cost per tonne increase?', 'How can we save 100,000 TND without reducing quality?', 'Should we purchase pulp now or negotiate?'],
  ar: ['ما هو أقصى سعر لـ SWL يجب أن ندفعه اليوم؟', 'انخفض سعر اللب البكر بنسبة 8٪. هل يجب إعادة التفاوض على أسعار الورق المسترجع؟', 'هل يمكن تخفيض سعر البكرة بنسبة 5٪؟', 'أي مورد يقدم أقل تكلفة فعلية للألياف؟', 'لماذا ارتفعت تكلفة الطن في PM2؟', 'كيف نوفر 100,000 دينار دون المساس بالجودة؟', 'هل نشتري اللب الآن أم نتفاوض؟'],
};

export async function aiPage(main) {
  const tab = qs().get('tab') || 'chat';
  const status = await api('/api/ai/status');
  clear(main);
  main.append(h('div', { class: 'ai-hero' }, h('div', { class: 'ai-mark', 'aria-hidden': 'true' }, '✦'), h('div', {}, h('h1', {}, t('ai_title')), h('p', { class: 'sub' }, t('ai_sub'))),
    h('div', { class: 'ai-conn' }, status.configured ? badge(`${t('connected')} · ${status.model}`, 'ok') : badge(t('connexion_requise'), 'warn'))));
  main.append(tabs([['chat', t('ai_chat')], ['decisions', t('decisions')], ['team', t('ai_team')]], tab, (x) => { setQs({ tab: x, id: null }); aiPage(main); }));
  const body = h('div', { class: 'tab-body' });
  main.append(body);
  if (tab === 'team') return teamTab(body, status, () => aiPage(main));
  if (tab === 'decisions') return decisionsTab(body);
  return chatTab(body, status);
}

function renderMarkdown(text) {
  // Minimal safe renderer: paragraphs, bullet lists, **bold**, tables with | — no raw HTML.
  const out = h('div', { class: 'md' });
  const inline = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((p) => (p.startsWith('**') && p.endsWith('**') ? h('strong', {}, p.slice(2, -2)) : p));
  const lines = text.split('\n');
  let list = null, tbl = null;
  for (const ln of lines) {
    const l = ln.trimEnd();
    if (/^\s*\|.*\|\s*$/.test(l)) {
      if (/^\s*\|[\s:\-|]+\|\s*$/.test(l)) continue;
      const cells = l.trim().slice(1, -1).split('|').map((c) => c.trim());
      if (!tbl) { tbl = h('table', { class: 'tbl tbl-md' }); out.append(h('div', { class: 'table-wrap' }, tbl)); tbl.append(h('tr', {}, cells.map((c) => h('th', {}, inline(c))))); }
      else tbl.append(h('tr', {}, cells.map((c) => h('td', {}, inline(c)))));
      continue;
    }
    tbl = null;
    const li = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (li) { if (!list) { list = h('ul'); out.append(list); } list.append(h('li', {}, inline(li[1]))); continue; }
    list = null;
    const hd = l.match(/^#{1,4}\s+(.*)/);
    if (hd) { out.append(h('h4', {}, inline(hd[1]))); continue; }
    if (l.trim()) out.append(h('p', {}, inline(l)));
  }
  return out;
}

async function chatTab(body, status) {
  const lang = getLang();
  let convId = Number(qs().get('c')) || null;
  const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
  const input = h('textarea', { rows: 2, placeholder: t('ai_placeholder'), maxlength: 4000, 'aria-label': t('ai_placeholder'), disabled: !status.configured || !can('ai') });
  const send = h('button', { class: 'btn btn-primary', disabled: !status.configured || !can('ai') }, t('ai_send'));
  const history = h('div', { class: 'chat-history' });
  const bubble = (role, text, tools) => h('div', { class: `msg msg-${role}` }, role === 'assistant' ? renderMarkdown(text) : h('p', {}, text),
    tools?.length ? h('details', { class: 'msg-tools' }, h('summary', {}, `${t('ai_tools_used')} (${tools.length})`), h('ul', {}, tools.map((x) => h('li', {}, x)))) : null);
  async function loadConv(id) {
    convId = id; setQs({ c: id });
    const c = await api(`/api/ai/conversations/${id}`);
    log.replaceChildren(...c.messages.map((m) => bubble(m.role, m.display_text, m.tools_used)));
    log.scrollTop = log.scrollHeight;
  }
  async function loadHistory() {
    if (!can('ai')) return;
    const list = await api('/api/ai/conversations');
    history.replaceChildren(h('button', { class: 'btn btn-sm', onclick: () => { convId = null; setQs({ c: null }); log.replaceChildren(examples()); } }, '＋ ', t('ai_new')),
      ...list.map((c) => h('button', { class: `conv ${c.id === convId ? 'active' : ''}`, onclick: () => loadConv(c.id) }, c.title, h('small', {}, dtFmt(c.updated_at)))));
  }
  const examples = () => h('div', { class: 'examples' }, (EXAMPLES[lang] || EXAMPLES.fr).map((q) => h('button', { class: 'chip', disabled: !status.configured || !can('ai'), onclick: () => { input.value = q; ask(); } }, q)));
  async function ask() {
    const q = input.value.trim();
    if (!q) return;
    input.value = ''; send.disabled = true;
    if (log.querySelector('.examples')) log.replaceChildren();
    log.append(bubble('user', q));
    const pending = h('div', { class: 'msg msg-assistant pending' }, h('span', { class: 'dots' }), t('ai_thinking'));
    log.append(pending); log.scrollTop = log.scrollHeight;
    try {
      const r = await api('/api/ai/chat', { method: 'POST', body: { message: q, conversation_id: convId } });
      pending.replaceWith(bubble('assistant', r.text, r.tools_used));
      if (!convId) { convId = r.conversation_id; setQs({ c: convId }); loadHistory(); }
    } catch (e) { pending.replaceWith(h('div', { class: 'msg msg-error' }, e.message)); }
    finally { send.disabled = false; log.scrollTop = log.scrollHeight; input.focus(); }
  }
  send.addEventListener('click', ask);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } });
  body.append(
    !status.configured ? h('div', { class: 'notice notice-warn' }, t('ai_not_configured'), ' ', h('a', { href: '#/admin?tab=connections' }, t('connections'))) : null,
    h('div', { class: 'chat' }, h('aside', {}, h('h3', {}, t('ai_history')), history), h('div', { class: 'chat-main' }, log, h('div', { class: 'chat-input' }, input, send))));
  if (convId) await loadConv(convId).catch(() => log.append(examples())); else log.append(examples());
  loadHistory();
}

async function decisionsTab(body) {
  const st = qs().get('status') || '';
  const focus = Number(qs().get('id')) || null;
  const rows = await api(`/api/recommendations${st ? `?status=${st}` : ''}`);
  const filter = h('div', { class: 'filters' }, [['', t('all')], ['proposed', 'proposed'], ['more_analysis', 'more_analysis'], ['approved', 'approved'], ['rejected', 'rejected']].map(([v, l]) =>
    h('button', { class: `chip ${st === v ? 'active' : ''}`, onclick: () => { setQs({ status: v || null }); decisionsTab(clear(body)); } }, v ? statusBadge(l) : l)),
    h('button', { class: 'btn btn-sm', onclick: () => download('/api/export/recommendations', 'recommandations.xlsx') }, '⤓ ', t('export')));
  body.append(filter);
  if (!rows.length) { body.append(emptyState('—', h('button', { class: 'btn btn-primary', onclick: () => runAnalysis(() => decisionsTab(clear(body))) }, t('analyze')))); return; }
  for (const r of rows) {
    const decide = async (decision) => {
      let note = '';
      if (decision !== 'approve') { note = await promptBox(t(decision === 'reject' ? 'reject' : 'more_analysis'), 'Commentaire', { minLength: 3 }); if (note === null) return; }
      const x = await guard(() => api(`/api/recommendations/${r.id}/decision`, { method: 'POST', body: { decision, note } }));
      toast(`${statusBadge(x.status).textContent} — ${x.external_actions}`);
      decisionsTab(clear(body));
    };
    const el = card(null, [
      h('div', { class: 'reco-head' }, statusBadge(r.status), h('span', { class: 'muted small' }, `#${r.id} · ${r.module} · ${r.created_by} · ${dtFmt(r.created_at)}`)),
      h('h3', { class: 'reco-title' }, r.title),
      h('p', {}, r.summary),
      h('div', { class: 'reco-facts' },
        h('div', {}, h('span', {}, t('savings_exp')), h('strong', { class: 'pos' }, r.savings_tnd ? tnd(r.savings_tnd) : '—')),
        h('div', {}, h('span', {}, 'Confiance'), h('strong', {}, r.confidence !== null ? pct(r.confidence * 100, 0) : '—')),
        h('div', {}, h('span', {}, 'Fraîcheur'), h('small', {}, r.data_freshness || '—'))),
      h('details', { open: focus === r.id }, h('summary', {}, t('details')),
        h('dl', { class: 'reco-dl' },
          h('dt', {}, 'Raisonnement'), h('dd', {}, r.reasoning || '—'),
          h('dt', {}, 'Données vérifiées'), h('dd', {}, h('code', {}, JSON.stringify(r.inputs))),
          h('dt', {}, 'Calcul'), h('dd', {}, h('pre', {}, JSON.stringify(r.calc, null, 2))),
          h('dt', {}, 'Risques qualité / production'), h('dd', {}, r.risks || '—'),
          h('dt', {}, 'Informations manquantes'), h('dd', {}, r.missing_info || '—'),
          r.decision_note ? [h('dt', {}, 'Décision'), h('dd', {}, `${r.decided_by_name || ''} · ${dtFmt(r.decided_at)} — ${r.decision_note}`)] : null)),
      ['proposed', 'more_analysis'].includes(r.status) && can('approve') ? h('div', { class: 'reco-actions' },
        h('button', { class: 'btn btn-primary', onclick: () => decide('approve') }, '✓ ', t('approve')),
        h('button', { class: 'btn', onclick: () => decide('more_analysis') }, '？ ', t('more_analysis')),
        h('button', { class: 'btn btn-danger-ghost', onclick: () => decide('reject') }, '✕ ', t('reject'))) : null,
    ], { cls: `reco ${focus === r.id ? 'focus' : ''}` });
    body.append(el);
  }
  if (focus) setTimeout(() => body.querySelector('.reco.focus')?.scrollIntoView({ block: 'center' }), 50);
}

function teamTab(body, status, rerender) {
  const lang = getLang();
  body.append(h('div', { class: 'notice' }, h('strong', {}, 'Garde-fous : '), status.guardrails.join(' · ')));
  body.append(card(L(status.director.name), [h('p', {}, status.director.mission), h('p', { class: 'muted small' }, status.director.tools.map((x) => x.name).join(' · '))], { cls: 'agent-director' }));
  const grid = h('div', { class: 'agents' });
  for (const a of status.agents) {
    const active = a.active.length > 0;
    grid.append(h('article', { class: `agent ${active ? 'is-active' : ''}` },
      h('header', {}, h('h4', {}, a.name[lang] || a.name.fr), active ? badge(`● ${t('agent_active')} — ${a.active[0].type}`, 'info') : badge(t('agent_idle'), 'muted')),
      h('p', {}, a.mission),
      h('details', {}, h('summary', {}, `${a.tools.length} outils autorisés`), h('ul', { class: 'small' }, a.tools.map((x) => h('li', {}, h('code', {}, x.name), x.writes ? ' (propose uniquement)' : '')))),
      a.scheduled_jobs ? h('p', { class: 'small muted' }, `Tâches planifiées : ${a.scheduled_jobs.join(', ')}`) : null,
      h('p', { class: 'small muted' }, `${t('last_run')} : ${a.stats?.last_run ? dtFmt(a.stats.last_run) : '—'} · ✓ ${a.stats?.ok ?? 0} · ✕ ${a.stats?.failed ?? 0}`),
      can('ai') ? h('button', { class: 'btn btn-sm', disabled: !status.configured, title: status.configured ? '' : t('connexion_requise'), onclick: async (e) => {
        e.target.disabled = true; e.target.textContent = t('ai_thinking');
        try { const r = await api(`/api/ai/agents/${a.id}/run`, { method: 'POST', body: {} }); toast('✓'); const m = h('div', { class: 'md' }); m.append(renderMarkdown(r.output.summary || '')); body.prepend(card(a.name[lang] || a.name.fr, m)); }
        catch (x) { toast(x.message, 'error'); } finally { e.target.disabled = false; e.target.textContent = t('run_analysis'); }
      } }, t('run_analysis')) : null));
  }
  body.append(grid);
}
