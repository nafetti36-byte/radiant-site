import { h, api, modal, buildForm, toast, table, statusBadge, download, can, guard, fmt } from './core.js';
import { t, L } from './i18n.js';
import { attachOfferLive, attachProductionLive } from './live.js';

export const GRADES_VP = ['BEKP', 'NBSK', 'BHKP', 'BSKP', 'FLUFF', 'OTHER_VP'];
export const GRADES_REC = ['SWL', 'HWS', 'SOP'];
export const CURRENCIES = ['TND', 'EUR', 'USD'];
const opt = (arr) => arr.map((x) => [x, x]);

let supplierCache = null;
export async function suppliersOptions(force) {
  if (!supplierCache || force) supplierCache = await api('/api/suppliers?limit=1000');
  return supplierCache.filter((s) => s.active).map((s) => [s.id, s.name]);
}
export const invalidateSuppliers = () => { supplierCache = null; };

export const FIELDS = {
  suppliers: () => [
    { key: 'name', label: { fr: 'Raison sociale', en: 'Company name', ar: 'اسم الشركة' }, required: true },
    { key: 'country', label: { fr: 'Pays', en: 'Country', ar: 'البلد' } },
    { key: 'categories', label: { fr: 'Catégories', en: 'Categories', ar: 'الفئات' }, type: 'select', options: [['virgin_pulp', { fr: 'Pâte vierge', en: 'Virgin pulp', ar: 'لب بكر' }], ['recovered', { fr: 'Papiers recyclés', en: 'Recovered paper', ar: 'ورق مسترجع' }], ['virgin_pulp,recovered', { fr: 'Les deux', en: 'Both', ar: 'كلاهما' }]] },
    { key: 'contact_name', label: { fr: 'Contact', en: 'Contact', ar: 'جهة الاتصال' } },
    { key: 'contact_email', label: { fr: 'Email', en: 'Email', ar: 'البريد' }, type: 'email' },
    { key: 'contact_phone', label: { fr: 'Téléphone', en: 'Phone', ar: 'الهاتف' }, type: 'tel' },
    { key: 'payment_terms_days', label: { fr: 'Délai de paiement (jours)', en: 'Payment terms (days)', ar: 'أجل الدفع (أيام)' }, type: 'number' },
    { key: 'incoterm', label: 'Incoterm' },
    { key: 'quality_rating', label: { fr: 'Note qualité (1-5)', en: 'Quality rating (1-5)', ar: 'تقييم الجودة' }, type: 'number' },
    { key: 'reliability_rating', label: { fr: 'Fiabilité livraison (1-5)', en: 'Delivery reliability (1-5)', ar: 'موثوقية التسليم' }, type: 'number' },
    { key: 'active', label: { fr: 'Actif', en: 'Active', ar: 'نشط' }, type: 'checkbox', default: 1 },
    { key: 'notes', label: { fr: 'Notes', en: 'Notes', ar: 'ملاحظات' }, type: 'textarea', full: true },
  ],
  offers: (category) => [
    { section: { fr: 'Offre', en: 'Offer', ar: 'العرض' } },
    { key: 'supplier_id', label: { fr: 'Fournisseur', en: 'Supplier', ar: 'المورد' }, type: 'select', required: true, options: () => window.__supplierOpts || [] },
    { key: 'grade', label: 'Grade', type: 'select', required: true, options: opt(category === 'virgin_pulp' ? GRADES_VP : category === 'recovered' ? GRADES_REC : [...GRADES_REC, ...GRADES_VP]), help: { fr: 'La catégorie se règle seule', en: 'Category is set automatically', ar: 'تُضبط الفئة تلقائيًا' } },
    { key: 'price', label: { fr: 'Prix nominal / t', en: 'Nominal price / t', ar: 'السعر الاسمي / طن' }, type: 'number', required: true },
    { key: 'currency', label: { fr: 'Devise', en: 'Currency', ar: 'العملة' }, type: 'select', required: true, options: opt(CURRENCIES), default: 'EUR' },
    { key: 'quantity_t', label: { fr: 'Quantité (t)', en: 'Quantity (t)', ar: 'الكمية (طن)' }, type: 'number' },
    { key: 'offer_date', label: { fr: 'Date de l’offre', en: 'Offer date', ar: 'تاريخ العرض' }, type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
    { key: 'valid_until', label: { fr: 'Valable jusqu’au', en: 'Valid until', ar: 'صالح حتى' }, type: 'date' },
    { key: 'category', label: { fr: 'Catégorie', en: 'Category', ar: 'الفئة' }, type: 'select', required: true, default: category || 'recovered', options: [['virgin_pulp', { fr: 'Pâte vierge', en: 'Virgin pulp', ar: 'لب بكر' }], ['recovered', { fr: 'Papier recyclé', en: 'Recovered paper', ar: 'ورق مسترجع' }]] },
    { key: 'incoterm', label: 'Incoterm', placeholder: 'CFR Radès, DAP…' },
    { key: 'payment_terms_days', label: { fr: 'Délai de paiement (j)', en: 'Payment terms (d)', ar: 'أجل الدفع' }, type: 'number' },
    { section: { fr: 'Coûts rendus et de transformation (TND/t)', en: 'Landed & conversion costs (TND/t)', ar: 'تكاليف الوصول والتحويل' } },
    { key: 'freight_tnd_t', label: { fr: 'Fret TND/t', en: 'Freight TND/t', ar: 'الشحن' }, type: 'number' },
    { key: 'customs_pct', label: { fr: 'Douane % de la valeur', en: 'Customs % of value', ar: 'الجمارك %' }, type: 'number' },
    { key: 'handling_tnd_t', label: { fr: 'Manutention TND/t', en: 'Handling TND/t', ar: 'المناولة' }, type: 'number' },
    { key: 'processing_tnd_t', label: { fr: 'Tri / pulpage / désencrage TND/t', en: 'Sorting / pulping / deinking TND/t', ar: 'الفرز وإزالة الحبر' }, type: 'number' },
    { key: 'energy_extra_tnd_t', label: { fr: 'Énergie incrémentale TND/t', en: 'Incremental energy TND/t', ar: 'طاقة إضافية' }, type: 'number' },
    { key: 'chemicals_extra_tnd_t', label: { fr: 'Chimie incrémentale TND/t', en: 'Incremental chemicals TND/t', ar: 'كيماويات إضافية' }, type: 'number' },
    { key: 'other_tnd_t', label: { fr: 'Autres coûts TND/t', en: 'Other costs TND/t', ar: 'تكاليف أخرى' }, type: 'number' },
    { section: { fr: 'Qualité et rendement fibre', en: 'Quality & fibre yield', ar: 'الجودة ومردود الألياف' } },
    { key: 'moisture_pct', label: { fr: 'Humidité %', en: 'Moisture %', ar: 'الرطوبة %' }, type: 'number', default: 10, help: { fr: 'Pâte séchée à l’air ≈ 10 %', en: 'Air-dry pulp ≈ 10%', ar: 'اللب المجفف ≈ 10%' } },
    { key: 'contamination_pct', label: { fr: 'Contaminants / impuretés %', en: 'Contaminants %', ar: 'الشوائب %' }, type: 'number', default: 0 },
    { key: 'process_loss_pct', label: { fr: 'Pertes tri + désencrage + fibres %', en: 'Sorting + deinking + fibre losses %', ar: 'الفاقد %' }, type: 'number', default: 0 },
    { key: 'brightness_iso', label: { fr: 'Blancheur ISO %', en: 'Brightness ISO %', ar: 'البياض ISO' }, type: 'number' },
    { key: 'notes', label: { fr: 'Notes', en: 'Notes', ar: 'ملاحظات' }, type: 'textarea', full: true },
  ],
  market_prices: (category) => [
    { key: 'grade', label: 'Grade', type: 'select', required: true, options: opt(category === 'recovered' ? GRADES_REC : [...GRADES_VP, ...GRADES_REC]) },
    { key: 'price_date', label: { fr: 'Date', en: 'Date', ar: 'التاريخ' }, type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
    { key: 'price', label: { fr: 'Prix / t', en: 'Price / t', ar: 'السعر / طن' }, type: 'number', required: true },
    { key: 'currency', label: { fr: 'Devise', en: 'Currency', ar: 'العملة' }, type: 'select', required: true, options: opt(['USD', 'EUR', 'TND']), default: 'USD' },
    { key: 'basis', label: { fr: 'Base (CIF, liste, net…)', en: 'Basis (CIF, list, net…)', ar: 'الأساس' } },
    { key: 'source', label: { fr: 'Source (publication sous licence, fournisseur…)', en: 'Source (licensed publication, supplier…)', ar: 'المصدر' }, required: true },
    { key: 'notes', label: { fr: 'Notes', en: 'Notes', ar: 'ملاحظات' }, type: 'textarea', full: true },
  ],
  fx_rates: () => [
    { key: 'currency', label: { fr: 'Devise', en: 'Currency', ar: 'العملة' }, type: 'select', required: true, options: opt(['EUR', 'USD', 'GBP', 'CNY']) },
    { key: 'rate_tnd', label: { fr: 'TND pour 1 unité', en: 'TND per 1 unit', ar: 'دينار لكل وحدة' }, type: 'number', required: true },
    { key: 'rate_date', label: { fr: 'Date', en: 'Date', ar: 'التاريخ' }, type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
    { key: 'source', label: { fr: 'Source', en: 'Source', ar: 'المصدر' }, required: true, default: 'BCT (fixing)' },
  ],
  production: () => [
    { section: { fr: 'Période', en: 'Period', ar: 'الفترة' } },
    { key: 'machine', label: 'Machine', type: 'select', required: true, options: [['PM1', 'PM1'], ['PM2', 'PM2']] },
    { key: 'period_start', label: { fr: 'Début', en: 'Start', ar: 'البداية' }, type: 'date', required: true },
    { key: 'period_end', label: { fr: 'Fin', en: 'End', ar: 'النهاية' }, type: 'date', required: true },
    { key: 'product_grade', label: { fr: 'Grade produit (ex. 2×17 g/m²)', en: 'Product grade', ar: 'درجة المنتج' }, required: true },
    { section: { fr: 'Tonnages et performance', en: 'Tonnage & performance', ar: 'الكميات والأداء' } },
    { key: 'gross_t', label: { fr: 'Production brute (t)', en: 'Gross production (t)', ar: 'الإنتاج الإجمالي' }, type: 'number' },
    { key: 'saleable_t', label: { fr: 'Tonnage vendable (t)', en: 'Saleable tonnage (t)', ar: 'الكمية القابلة للبيع' }, type: 'number', required: true },
    { key: 'avg_selling_price_tnd_t', label: { fr: 'Prix de vente moyen (TND/t)', en: 'Average selling price (TND/t)', ar: 'متوسط سعر البيع' }, type: 'number' },
    { key: 'rejects_t', label: { fr: 'Rebuts / casses (t) — auto si brut saisi', en: 'Rejects / broke (t) — auto from gross', ar: 'المرفوضات' }, type: 'number' },
    { key: 'downtime_h', label: { fr: 'Arrêts (h)', en: 'Downtime (h)', ar: 'التوقفات (س)' }, type: 'number' },
    { key: 'available_h', label: { fr: 'Heures disponibles', en: 'Available hours', ar: 'الساعات المتاحة' }, type: 'number' },
    { key: 'closing_stock_t', label: { fr: 'Stock fin de période (t)', en: 'Closing stock (t)', ar: 'المخزون النهائي' }, type: 'number' },
    { section: { fr: 'Fibres', en: 'Fibre', ar: 'الألياف' } },
    { key: 'vp_t', label: { fr: 'Pâte vierge consommée (t)', en: 'Virgin pulp used (t)', ar: 'اللب البكر (طن)' }, type: 'number' },
    { key: 'vp_price_tnd_t', virtual: true, label: { fr: 'Prix moyen pâte vierge (TND/t)', en: 'Avg virgin pulp price (TND/t)', ar: 'متوسط سعر اللب' }, type: 'number', help: { fr: 'Le coût total se calcule seul', en: 'Total cost is computed', ar: 'تُحسب التكلفة تلقائيًا' } },
    { key: 'vp_cost_tnd', label: { fr: 'Coût pâte vierge (TND) — auto', en: 'Virgin pulp cost (TND) — auto', ar: 'تكلفة اللب البكر' }, type: 'number' },
    { key: 'recovered_t', label: { fr: 'Fibres recyclées consommées (t)', en: 'Recovered fibre used (t)', ar: 'الألياف المسترجعة' }, type: 'number' },
    { key: 'recovered_price_tnd_t', virtual: true, label: { fr: 'Prix moyen fibres recyclées (TND/t)', en: 'Avg recovered fibre price (TND/t)', ar: 'متوسط سعر المسترجع' }, type: 'number', help: { fr: 'Le coût total se calcule seul', en: 'Total cost is computed', ar: 'تُحسب التكلفة تلقائيًا' } },
    { key: 'recovered_cost_tnd', label: { fr: 'Coût fibres recyclées (TND) — auto', en: 'Recovered fibre cost (TND) — auto', ar: 'تكلفة المسترجع' }, type: 'number' },
    { section: { fr: 'Énergie et eau', en: 'Energy & water', ar: 'الطاقة والمياه' } },
    { key: 'electricity_kwh', label: { fr: 'Électricité (kWh)', en: 'Electricity (kWh)', ar: 'الكهرباء' }, type: 'number' },
    { key: 'electricity_tariff', label: { fr: 'Tarif électricité (TND/kWh)', en: 'Electricity tariff (TND/kWh)', ar: 'تعريفة الكهرباء' }, type: 'number' },
    { key: 'gas_nm3', label: { fr: 'Gaz (Nm³)', en: 'Gas (Nm³)', ar: 'الغاز' }, type: 'number' },
    { key: 'gas_tariff', label: { fr: 'Tarif gaz (TND/Nm³)', en: 'Gas tariff', ar: 'تعريفة الغاز' }, type: 'number' },
    { key: 'steam_t', label: { fr: 'Vapeur (t)', en: 'Steam (t)', ar: 'البخار' }, type: 'number' },
    { key: 'steam_cost_tnd_t', label: { fr: 'Coût vapeur (TND/t)', en: 'Steam cost (TND/t)', ar: 'تكلفة البخار' }, type: 'number' },
    { key: 'cogen_allocation_tnd', label: { fr: 'Allocation cogénération (TND, négatif = crédit)', en: 'Cogeneration allocation (TND, negative = credit)', ar: 'حصة التوليد المشترك' }, type: 'number' },
    { key: 'water_m3', label: { fr: 'Eau (m³)', en: 'Water (m³)', ar: 'المياه' }, type: 'number' },
    { key: 'water_tariff', label: { fr: 'Tarif eau (TND/m³)', en: 'Water tariff', ar: 'تعريفة المياه' }, type: 'number' },
    { section: { fr: 'Autres coûts (TND)', en: 'Other costs (TND)', ar: 'تكاليف أخرى' } },
    { key: 'chemicals_tnd', label: { fr: 'Chimie', en: 'Chemicals', ar: 'الكيماويات' }, type: 'number' },
    { key: 'packaging_tnd', label: { fr: 'Emballage', en: 'Packaging', ar: 'التغليف' }, type: 'number' },
    { key: 'labour_tnd', label: { fr: 'Main-d’œuvre', en: 'Labour', ar: 'اليد العاملة' }, type: 'number' },
    { key: 'maintenance_tnd', label: { fr: 'Maintenance', en: 'Maintenance', ar: 'الصيانة' }, type: 'number' },
    { key: 'fixed_overhead_tnd', label: { fr: 'Frais généraux fixes', en: 'Fixed overheads', ar: 'المصاريف الثابتة' }, type: 'number' },
    { key: 'variable_overhead_tnd', label: { fr: 'Frais généraux variables', en: 'Variable overheads', ar: 'المصاريف المتغيرة' }, type: 'number' },
    { key: 'freight_selling_tnd', label: { fr: 'Transport & frais de vente', en: 'Freight & selling', ar: 'النقل والبيع' }, type: 'number' },

    { key: 'notes', label: { fr: 'Notes', en: 'Notes', ar: 'ملاحظات' }, type: 'textarea', full: true },
  ],
  savings: () => [
    { key: 'title', label: { fr: 'Intitulé', en: 'Title', ar: 'العنوان' }, required: true, full: true },
    { key: 'category', label: { fr: 'Catégorie', en: 'Category', ar: 'الفئة' }, type: 'select', required: true, options: [['fibre', 'Fibre'], ['energy', { fr: 'Énergie', en: 'Energy', ar: 'الطاقة' }], ['chemicals', { fr: 'Chimie', en: 'Chemicals', ar: 'الكيماويات' }], ['yield', { fr: 'Rendement', en: 'Yield', ar: 'المردود' }], ['logistics', { fr: 'Logistique', en: 'Logistics', ar: 'اللوجستيك' }], ['pricing', { fr: 'Prix de vente', en: 'Pricing', ar: 'التسعير' }], ['other', { fr: 'Autre', en: 'Other', ar: 'أخرى' }]] },
    { key: 'status', label: { fr: 'Statut', en: 'Status', ar: 'الحالة' }, type: 'select', options: [['identified', { fr: 'Identifiée', en: 'Identified', ar: 'محددة' }], ['validated', { fr: 'Validée', en: 'Validated', ar: 'معتمدة' }], ['in_progress', { fr: 'En cours', en: 'In progress', ar: 'قيد التنفيذ' }], ['realized', { fr: 'Réalisée', en: 'Realized', ar: 'محققة' }], ['rejected', { fr: 'Rejetée', en: 'Rejected', ar: 'مرفوضة' }]], default: 'identified' },
    { key: 'baseline_tnd', label: { fr: 'Coût de référence (TND)', en: 'Baseline cost (TND)', ar: 'التكلفة المرجعية' }, type: 'number' },
    { key: 'projected_tnd', label: { fr: 'Économie prévue (TND)', en: 'Projected savings (TND)', ar: 'التوفير المتوقع' }, type: 'number' },
    { key: 'realized_tnd', label: { fr: 'Économie réalisée (TND)', en: 'Realized savings (TND)', ar: 'التوفير المحقق' }, type: 'number' },
    { key: 'owner', label: { fr: 'Responsable', en: 'Owner', ar: 'المسؤول' } },
    { key: 'due_date', label: { fr: 'Échéance', en: 'Due date', ar: 'الموعد' }, type: 'date' },
    { key: 'quality_validated', label: { fr: 'Validée par la qualité', en: 'Quality validated', ar: 'معتمدة من الجودة' }, type: 'checkbox' },
    { key: 'description', label: { fr: 'Description', en: 'Description', ar: 'الوصف' }, type: 'textarea', full: true },
  ],
};

export async function openEntityForm(entity, { values = {}, id = null, category, title, onSaved } = {}) {
  if (entity === 'offers') window.__supplierOpts = await suppliersOptions(true);
  if (entity === 'offers' && !window.__supplierOpts.length) { toast({ fr: 'Créez d’abord un fournisseur', en: 'Create a supplier first', ar: 'أنشئ موردًا أولًا' }[document.documentElement.lang] || 'Créez d’abord un fournisseur', 'error'); return; }
  let m;
  const preview = ['offers', 'production'].includes(entity) ? h('div') : null;
  let live = null;
  const form = buildForm(FIELDS[entity](category), values, async (data) => {
    if (id) await api(`/api/${entity}/${id}`, { method: 'PUT', body: data });
    else await api(`/api/${entity}`, { method: 'POST', body: data });
    if (entity === 'suppliers') invalidateSuppliers();
    m.close(); toast(['offers', 'production', 'market_prices', 'fx_rates'].includes(entity) ? `${t('saved')} — analyse mise à jour automatiquement` : t('saved')); onSaved?.();
  }, { preview, onInput: preview ? (d, f) => live && live(d, f) : undefined });
  if (entity === 'offers') attachOfferLive(form, preview, { id }).then((fn) => { live = fn; fn(form.getData(), form); });
  if (entity === 'production') attachProductionLive(form, preview, { id }).then((fn) => { live = fn; fn(form.getData(), form); });
  m = modal(title || (id ? t('edit') : t('add')), form, { wide: ['offers', 'production'].includes(entity) });
}

const kindLabel = () => ({ suppliers: t('suppliers'), offers: t('offers'), market_prices: t('market_prices'), fx_rates: 'Taux de change / FX', production: t('periods') });

/** Import wizard: template → upload → validated preview → commit. */
export function openImport(kind, onDone) {
  const body = h('div', { class: 'import' });
  const KIND_LABEL = kindLabel();
  const kinds = kind ? [kind] : Object.keys(KIND_LABEL);
  const sel = h('select', {}, kinds.map((k) => h('option', { value: k }, KIND_LABEL[k] || k)));
  const fileIn = h('input', { type: 'file', accept: '.xlsx,.csv', 'aria-label': t('choose_file') });
  const result = h('div');
  const step1 = h('div', { class: 'import-steps' },
    h('label', { class: 'field' }, h('span', {}, 'Type'), sel),
    h('p', { class: 'muted' }, '1. ', h('button', { class: 'btn btn-link', type: 'button', onclick: () => download(`/api/imports/template/${sel.value}`, `modele-${sel.value}.xlsx`) }, t('template')), ' · 2. ', t('choose_file'), ' · 3. ', t('preview'), ' · 4. ', t('commit')),
    h('label', { class: 'field' }, h('span', {}, t('choose_file')), fileIn),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
      if (!fileIn.files[0]) { toast(t('choose_file'), 'error'); return; }
      const fd = new FormData(); fd.append('kind', sel.value); fd.append('file', fileIn.files[0]);
      const r = await guard(() => api('/api/imports', { method: 'POST', form: fd }));
      showPreview(r);
    } }, t('preview')));
  body.append(step1, result);
  const m = modal(`${t('import')} — Excel / CSV`, body, { wide: true });
  function showPreview(r) {
    result.replaceChildren(
      h('p', {}, h('strong', {}, `${r.rows_valid} / ${r.rows_total} ${t('rows_valid')}`), r.truncated ? ' · (2000 lignes max.)' : ''),
      r.unmapped?.length ? h('div', { class: 'notice notice-warn' }, h('strong', {}, 'Colonnes non reconnues, elles ne seront PAS importées : '), r.unmapped.join(', '), ' — renommez-les selon le modèle Excel.') : null,
      table([{ key: 'row', label: '#' }, { key: 'valid', label: t('status'), render: (x) => statusBadge(x.valid ? 'validated' : 'rejected') }, { key: 'data', label: t('details'), render: (x) => Object.entries(x.data).filter(([, v]) => v !== null).slice(0, 6).map(([k, v]) => `${k}=${v}`).join(' · ') }, { key: 'errors', label: t('error'), render: (x) => Object.entries(x.errors).map(([k, v]) => `${k}: ${v}`).join('; ') || '—' }], r.preview),
      h('div', { class: 'form-actions' },
        h('button', { class: 'btn', onclick: async () => { await guard(() => api(`/api/imports/${r.id}/reject`, { method: 'POST' })); m.close(); } }, t('reject')),
        h('button', { class: 'btn btn-primary', disabled: !r.rows_valid, onclick: async () => { const x = await guard(() => api(`/api/imports/${r.id}/commit`, { method: 'POST' })); toast(`${x.inserted} ✓`); invalidateSuppliers(); m.close(); onDone?.(); } }, `${t('commit')} (${r.rows_valid})`)));
  }
}

/** Page header with the four always-visible primary actions. */
export function actionBar({ onAdd, onImport, onAnalyze, onExport, extra } = {}) {
  const b = (label, icon, fn, cls = '') => fn ? h('button', { class: `btn ${cls}`, onclick: fn }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon), h('span', {}, label)) : null;
  return h('div', { class: 'action-bar' },
    can('write') ? b(t('add'), '＋', onAdd, 'btn-primary') : null,
    can('write') ? b(t('import'), '⤒', onImport) : null,
    b(t('analyze'), '◎', onAnalyze),
    b(t('export'), '⤓', onExport),
    extra || null);
}

export function pageHead(title, sub, bar) {
  return h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, title), sub ? h('p', { class: 'sub' }, sub) : null), bar || null);
}

export async function runAnalysis(after) {
  const r = await guard(() => api('/api/analysis/run', { method: 'POST' }));
  if (r.ok) toast(`${t('analyze')} ✓ — ${r.output.recommendations_created} reco · ${r.output.alerts_created} alertes`);
  else toast(r.error, 'error');
  after?.();
}

export const money = (v, cur = 'TND', d = 2) => (v === null || v === undefined ? '—' : `${fmt(v, d)} ${cur}`);
export const label = L;
