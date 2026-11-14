// Calculator library — pure definitions (no DOM) so they are unit-tested.
// Each calculator: inputs (what is needed), formula (shown to the user), compute() → results.
// Formulas that exist in the engine reuse it (engine.js is compiled from src/engine).
import { effectiveCost, recoveredCeiling, negotiationTarget, computePeriod } from './engine.js';

const n = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const need = (v, ...keys) => keys.every((k) => n(v[k]) !== null);
const r = (label, value, unit = '', extra = {}) => ({ label, value, unit, ...extra });

// label helper: [fr, en, ar]
const T = (fr, en, ar) => ({ fr, en, ar });

export const CATEGORIES = [
  { id: 'purchase', icon: '🛒', label: T('Achats & fibres', 'Purchasing & fibre', 'المشتريات والألياف') },
  { id: 'production', icon: '⚙️', label: T('Production', 'Production', 'الإنتاج') },
  { id: 'energy', icon: '⚡', label: T('Énergie', 'Energy', 'الطاقة') },
  { id: 'finance', icon: '💰', label: T('Prix & finance', 'Pricing & finance', 'الأسعار والمالية') },
];

export const CALCULATORS = [
  // ───────── Achats & fibres ─────────
  {
    id: 'fx', cat: 'purchase', icon: '💱', title: T('Conversion de devise', 'Currency conversion', 'تحويل العملات'),
    desc: T('Convertir un prix EUR/USD en TND avec le taux enregistré.', 'Convert an EUR/USD price to TND with the stored rate.', 'تحويل سعر من يورو/دولار إلى دينار.'),
    inputs: [
      { key: 'amount', label: T('Montant', 'Amount', 'المبلغ'), unit: 'EUR/USD', where: T('Offre fournisseur', 'Supplier offer', 'عرض المورد') },
      { key: 'rate', label: T('Taux (TND pour 1 unité)', 'Rate (TND per unit)', 'السعر (دينار للوحدة)'), unit: 'TND', ctx: 'fx_eur', where: T('Pré-rempli : dernier taux EUR enregistré', 'Pre-filled: latest stored EUR rate', 'آخر سعر مسجل') },
    ],
    formula: 'TND = montant × taux',
    compute: (v) => need(v, 'amount', 'rate') ? [r(T('Montant en TND', 'Amount in TND', 'المبلغ بالدينار'), n(v.amount) * n(v.rate), 'TND', { main: true })] : null,
  },
  {
    id: 'landed', cat: 'purchase', icon: '🚢', title: T('Coût rendu usine (import)', 'Landed cost (import)', 'تكلفة الوصول للمصنع'),
    desc: T('Prix fournisseur + fret + assurance + douane + manutention, en TND par tonne.', 'Supplier price + freight + insurance + customs + handling, TND per tonne.', 'سعر المورد + الشحن + التأمين + الجمارك + المناولة.'),
    inputs: [
      { key: 'price', label: T('Prix fournisseur / t', 'Supplier price / t', 'سعر المورد/طن'), unit: 'devise', where: T('Offre / facture', 'Offer / invoice', 'العرض/الفاتورة') },
      { key: 'rate', label: T('Taux de change', 'Exchange rate', 'سعر الصرف'), unit: 'TND', ctx: 'fx_usd', def: 1 },
      { key: 'freight', label: T('Fret maritime / t', 'Sea freight / t', 'الشحن البحري/طن'), unit: 'TND', def: 0 },
      { key: 'insurance_pct', label: T('Assurance', 'Insurance', 'التأمين'), unit: '%', def: 0 },
      { key: 'customs_pct', label: T('Droits de douane', 'Customs duty', 'الرسوم الجمركية'), unit: '%', def: 0 },
      { key: 'handling', label: T('Port + transit + transport / t', 'Port + forwarding + trucking / t', 'الميناء والنقل/طن'), unit: 'TND', def: 0 },
    ],
    formula: 'Rendu = prix × taux × (1 + assurance% + douane%) + fret + manutention',
    compute: (v) => {
      if (!need(v, 'price', 'rate')) return null;
      const base = n(v.price) * n(v.rate);
      const ins = base * (n(v.insurance_pct) ?? 0) / 100, cus = base * (n(v.customs_pct) ?? 0) / 100;
      const total = base + ins + cus + (n(v.freight) ?? 0) + (n(v.handling) ?? 0);
      return [r(T('Prix en TND', 'Price in TND', 'السعر بالدينار'), base, 'TND/t'), r(T('Assurance + douane', 'Insurance + customs', 'التأمين والجمارك'), ins + cus, 'TND/t'), r(T('Coût rendu usine', 'Landed cost', 'تكلفة الوصول'), total, 'TND/t', { main: true }), r(T('Surcoût vs prix', 'Uplift vs price', 'الزيادة'), base ? (total / base - 1) * 100 : null, '%')];
    },
  },
  {
    id: 'dry', cat: 'purchase', icon: '💧', title: T('Poids sec (humidité)', 'Dry weight (moisture)', 'الوزن الجاف'),
    desc: T('Ce que vous payez vraiment en fibre sèche quand le lot est humide.', 'What you really pay per dry tonne when the lot is wet.', 'ما تدفعه فعليًا للطن الجاف.'),
    inputs: [
      { key: 'weight', label: T('Poids livré', 'Delivered weight', 'الوزن المسلّم'), unit: 't', where: T('Pont-bascule', 'Weighbridge', 'الميزان') },
      { key: 'moisture', label: T('Humidité mesurée', 'Measured moisture', 'الرطوبة المقاسة'), unit: '%', def: 10, where: T('Labo / sonde', 'Lab / probe', 'المختبر') },
      { key: 'std', label: T('Humidité contractuelle', 'Contract moisture', 'الرطوبة التعاقدية'), unit: '%', def: 10 },
      { key: 'price', label: T('Prix / t', 'Price / t', 'السعر/طن'), unit: 'TND', def: null },
    ],
    formula: 'Sec = poids × (1 − humidité%) ; Poids facturable = sec / (1 − humidité contractuelle%)',
    compute: (v) => {
      if (!need(v, 'weight', 'moisture')) return null;
      const dry = n(v.weight) * (1 - n(v.moisture) / 100);
      const billable = dry / (1 - (n(v.std) ?? 10) / 100);
      const out = [r(T('Fibre sèche', 'Dry fibre', 'الألياف الجافة'), dry, 't', { main: true }), r(T('Poids facturable (base contractuelle)', 'Billable weight (contract basis)', 'الوزن القابل للفوترة'), billable, 't'), r(T('Écart à réclamer', 'Weight to claim', 'الفرق للمطالبة'), n(v.weight) - billable, 't')];
      if (n(v.price)) out.push(r(T('Montant à réclamer', 'Amount to claim', 'المبلغ للمطالبة'), (n(v.weight) - billable) * n(v.price), 'TND', { main: true }));
      return out;
    },
  },
  {
    id: 'effective', cat: 'purchase', icon: '🧪', title: T('Coût fibre effectif', 'Effective fibre cost', 'التكلفة الفعلية للألياف'),
    desc: T('Comparer pâte et recyclés sur la même base : TND par tonne de fibre réellement utilisable.', 'Compare pulp and recovered paper on one basis: TND per usable tonne.', 'مقارنة اللب والمسترجع على أساس واحد.'),
    inputs: [
      { key: 'price', label: T('Prix / t', 'Price / t', 'السعر/طن'), unit: 'TND' },
      { key: 'freight', label: T('Fret / t', 'Freight / t', 'الشحن/طن'), unit: 'TND', def: 0 },
      { key: 'processing', label: T('Tri, pulpage, désencrage / t', 'Sorting, pulping, deinking / t', 'الفرز وإزالة الحبر/طن'), unit: 'TND', def: 0 },
      { key: 'energy', label: T('Énergie supplémentaire / t', 'Extra energy / t', 'طاقة إضافية/طن'), unit: 'TND', def: 0 },
      { key: 'chemicals', label: T('Chimie supplémentaire / t', 'Extra chemicals / t', 'كيماويات إضافية/طن'), unit: 'TND', def: 0 },
      { key: 'moisture', label: T('Humidité', 'Moisture', 'الرطوبة'), unit: '%', def: 10 },
      { key: 'contamination', label: T('Contaminants', 'Contaminants', 'الشوائب'), unit: '%', def: 0 },
      { key: 'loss', label: T('Pertes process', 'Process losses', 'فاقد العملية'), unit: '%', def: 0 },
      { key: 'payment_days', label: T('Délai de paiement', 'Payment terms', 'أجل الدفع'), unit: 'j', def: null },
    ],
    formula: 'Rendement = (1−humidité)(1−contaminants)(1−pertes) ; Coût effectif = (prix + fret + traitement + énergie + chimie + financement) / rendement',
    compute: (v, ctx) => {
      if (!need(v, 'price')) return null;
      const c = effectiveCost({ price: n(v.price), currency: 'TND', fx_tnd: 1, freight_tnd_t: n(v.freight) ?? 0, customs_pct: 0, handling_tnd_t: 0, processing_tnd_t: n(v.processing) ?? 0, energy_extra_tnd_t: n(v.energy) ?? 0, chemicals_extra_tnd_t: n(v.chemicals) ?? 0, other_tnd_t: 0, moisture_pct: n(v.moisture) ?? 10, contamination_pct: n(v.contamination) ?? 0, process_loss_pct: n(v.loss) ?? 0, payment_terms_days: n(v.payment_days) }, ctx?.fin ?? { cost_of_capital_pct: 10, inventory_days: 30 });
      return [r(T('Rendement fibre utile', 'Usable fibre yield', 'مردود الألياف'), c.usable_yield * 100, '%'), r(T('Coût attribuable / t achetée', 'Attributable cost / t bought', 'التكلفة لكل طن مشترى'), c.attributable_tnd_t, 'TND'), r(T('Coût effectif / t fibre utile', 'Effective cost / usable t', 'التكلفة الفعلية/طن صافٍ'), c.effective_tnd_per_usable_t, 'TND', { main: true })];
    },
  },
  {
    id: 'ceiling', cat: 'purchase', icon: '🎯', title: T('Plafond d’achat recyclé', 'Recovered-paper buying ceiling', 'سقف شراء الورق المسترجع'),
    desc: T('Prix maximum pour SWL/HWS/SOP au-delà duquel la pâte vierge devient plus intéressante.', 'Maximum SWL/HWS/SOP price before virgin pulp becomes cheaper.', 'أقصى سعر قبل أن يصبح اللب البكر أرخص.'),
    inputs: [
      { key: 'vp_eff', label: T('Coût effectif pâte vierge de référence', 'Reference virgin pulp effective cost', 'التكلفة الفعلية للب المرجعي'), unit: 'TND/t utile', ctx: 'vp_ref', where: T('Pré-rempli depuis vos références', 'Pre-filled from your references', 'من مراجعكم') },
      { key: 'vp_nominal', label: T('Prix pâte vierge (nominal) en TND', 'Virgin pulp nominal price in TND', 'السعر الاسمي للب'), unit: 'TND/t', ctx: 'vp_nominal' },
      { key: 'equiv', label: T('Équivalence qualité', 'Quality equivalence', 'التكافؤ في الجودة'), unit: '%', def: 95 },
      { key: 'price', label: T('Prix proposé (pour comparer)', 'Offered price (to compare)', 'السعر المعروض'), unit: 'TND/t', def: null },
      { key: 'freight', label: T('Fret / t', 'Freight / t', 'الشحن/طن'), unit: 'TND', def: 0 },
      { key: 'processing', label: T('Tri + désencrage / t', 'Sorting + deinking / t', 'الفرز/طن'), unit: 'TND', def: 0 },
      { key: 'energy', label: T('Énergie supplémentaire / t', 'Extra energy / t', 'طاقة إضافية'), unit: 'TND', def: 0 },
      { key: 'chemicals', label: T('Chimie supplémentaire / t', 'Extra chemicals / t', 'كيماويات إضافية'), unit: 'TND', def: 0 },
      { key: 'moisture', label: T('Humidité', 'Moisture', 'الرطوبة'), unit: '%', def: 10 },
      { key: 'contamination', label: T('Contaminants', 'Contaminants', 'الشوائب'), unit: '%', def: 3 },
      { key: 'loss', label: T('Pertes process', 'Process losses', 'الفاقد'), unit: '%', def: 15 },
      { key: 'quantity', label: T('Quantité', 'Quantity', 'الكمية'), unit: 't', def: null },
    ],
    formula: 'Prix max = (coût effectif VP × équivalence × rendement − coûts fixes/t) / (1 + financement) ; plafonné au prix nominal de la pâte vierge',
    compute: (v, ctx) => {
      if (!need(v, 'vp_eff')) return null;
      const input = { price: n(v.price) ?? 1, currency: 'TND', fx_tnd: 1, freight_tnd_t: n(v.freight) ?? 0, customs_pct: 0, handling_tnd_t: 0, processing_tnd_t: n(v.processing) ?? 0, energy_extra_tnd_t: n(v.energy) ?? 0, chemicals_extra_tnd_t: n(v.chemicals) ?? 0, other_tnd_t: 0, moisture_pct: n(v.moisture) ?? 10, contamination_pct: n(v.contamination) ?? 0, process_loss_pct: n(v.loss) ?? 0, payment_terms_days: null };
      const fin = ctx?.fin ?? { cost_of_capital_pct: 10, inventory_days: 30 };
      const c = recoveredCeiling(input, fin, n(v.vp_eff), n(v.equiv) ?? 95, n(v.vp_nominal), false);
      const out = [r(T('Prix maximum', 'Maximum price', 'السعر الأقصى'), c.ceiling, 'TND/t', { main: true }), r(T('Règle appliquée', 'Rule applied', 'القاعدة'), c.ceiling_rule === 'vp_nominal_cap' ? T('≤ prix pâte vierge', '≤ virgin pulp price', '≤ سعر اللب') : T('parité coût effectif', 'effective-cost parity', 'تكافؤ التكلفة'), '')];
      if (n(v.price)) {
        const t = negotiationTarget(n(v.price), c.ceiling, ctx?.negotiation_margin_pct ?? 5, null, 1, n(v.quantity));
        out.push(r(T('Prix cible de négociation', 'Negotiation target', 'السعر المستهدف'), t.target_price, 'TND/t'));
        out.push(r(T('Verdict', 'Verdict', 'الحكم'), t.above_ceiling ? T('Trop cher : négocier', 'Too expensive: negotiate', 'مرتفع: تفاوض') : T('Acceptable', 'Acceptable', 'مقبول'), '', { tone: t.above_ceiling ? 'bad' : 'ok' }));
        if (t.expected_savings_tnd) out.push(r(T('Économie attendue', 'Expected savings', 'التوفير المتوقع'), t.expected_savings_tnd, 'TND', { main: true }));
      }
      return out;
    },
  },
  {
    id: 'mix', cat: 'purchase', icon: '⚖️', title: T('Mix fibre & coût fibre par tonne', 'Fibre mix & fibre cost per tonne', 'مزيج الألياف وتكلفتها'),
    desc: T('Part de recyclé et coût fibre par tonne de papier vendable.', 'Recovered share and fibre cost per saleable tonne.', 'نسبة المسترجع وتكلفة الألياف للطن.'),
    inputs: [
      { key: 'vp_t', label: T('Pâte vierge consommée', 'Virgin pulp used', 'اللب البكر المستهلك'), unit: 't' },
      { key: 'vp_price', label: T('Prix moyen pâte vierge', 'Avg virgin pulp price', 'متوسط سعر اللب'), unit: 'TND/t' },
      { key: 'rec_t', label: T('Recyclé consommé', 'Recovered used', 'المسترجع المستهلك'), unit: 't' },
      { key: 'rec_price', label: T('Prix moyen recyclé', 'Avg recovered price', 'متوسط سعر المسترجع'), unit: 'TND/t' },
      { key: 'saleable', label: T('Production vendable', 'Saleable production', 'الإنتاج القابل للبيع'), unit: 't' },
    ],
    formula: 'Mix recyclé = recyclé / (vierge + recyclé) ; Coût fibre / t = (t vierge × prix + t recyclé × prix) / t vendables ; Consommation = fibre / vendable',
    compute: (v) => {
      if (!need(v, 'vp_t', 'rec_t')) return null;
      const tot = n(v.vp_t) + n(v.rec_t);
      const cost = n(v.vp_t) * (n(v.vp_price) ?? 0) + n(v.rec_t) * (n(v.rec_price) ?? 0);
      const out = [r(T('Part recyclé', 'Recovered share', 'نسبة المسترجع'), tot ? (n(v.rec_t) / tot) * 100 : null, '%'), r(T('Coût fibre total', 'Total fibre cost', 'تكلفة الألياف'), cost, 'TND')];
      if (n(v.saleable)) out.push(r(T('Coût fibre / t vendable', 'Fibre cost / saleable t', 'تكلفة الألياف/طن'), cost / n(v.saleable), 'TND', { main: true }), r(T('Consommation fibre / t', 'Fibre use / t', 'استهلاك الألياف/طن'), tot / n(v.saleable), 't/t'));
      return out;
    },
  },
  {
    id: 'nego', cat: 'purchase', icon: '🤝', title: T('Gain de négociation', 'Negotiation gain', 'مكسب التفاوض'),
    desc: T('Valeur en TND d’une baisse de prix obtenue.', 'TND value of a price reduction obtained.', 'قيمة خفض السعر بالدينار.'),
    inputs: [
      { key: 'old', label: T('Prix initial / t', 'Initial price / t', 'السعر الأولي'), unit: 'devise' },
      { key: 'new', label: T('Prix négocié / t', 'Negotiated price / t', 'السعر المتفاوض'), unit: 'devise' },
      { key: 'qty', label: T('Quantité', 'Quantity', 'الكمية'), unit: 't' },
      { key: 'rate', label: T('Taux de change', 'Exchange rate', 'سعر الصرف'), unit: 'TND', def: 1 },
    ],
    formula: 'Gain = (prix initial − prix négocié) × quantité × taux',
    compute: (v) => need(v, 'old', 'new', 'qty') ? [r(T('Baisse obtenue', 'Reduction', 'الانخفاض'), ((n(v.old) - n(v.new)) / n(v.old)) * 100, '%'), r(T('Gain / t', 'Gain / t', 'المكسب/طن'), (n(v.old) - n(v.new)) * (n(v.rate) ?? 1), 'TND'), r(T('Gain total', 'Total gain', 'المكسب الإجمالي'), (n(v.old) - n(v.new)) * n(v.qty) * (n(v.rate) ?? 1), 'TND', { main: true })] : null,
  },

  // ───────── Production ─────────
  {
    id: 'pm_output', cat: 'production', icon: '🏭', title: T('Production horaire machine', 'Machine hourly output', 'إنتاج الآلة بالساعة'),
    desc: T('Tonnes par heure et par jour à partir de la vitesse, la laize et le grammage.', 'Tonnes per hour/day from speed, width and grammage.', 'الأطنان بالساعة من السرعة والعرض والوزن.'),
    inputs: [
      { key: 'speed', label: T('Vitesse bobineuse', 'Reel speed', 'سرعة البكرة'), unit: 'm/min', where: T('Pupitre machine', 'Machine panel', 'لوحة الآلة') },
      { key: 'width', label: T('Laize utile', 'Trimmed width', 'العرض الصافي'), unit: 'm' },
      { key: 'gsm', label: T('Grammage', 'Grammage', 'الوزن'), unit: 'g/m²' },
      { key: 'eff', label: T('Efficacité (temps de marche × rendement)', 'Efficiency (uptime × yield)', 'الكفاءة'), unit: '%', def: 90 },
      { key: 'hours', label: T('Heures de marche / jour', 'Running hours / day', 'ساعات التشغيل/يوم'), unit: 'h', def: 24 },
    ],
    formula: 't/h = vitesse × laize × grammage × 60 / 1 000 000 ; t/jour = t/h × heures × efficacité',
    compute: (v) => {
      if (!need(v, 'speed', 'width', 'gsm')) return null;
      const th = n(v.speed) * n(v.width) * n(v.gsm) * 60 / 1e6;
      const day = th * (n(v.hours) ?? 24) * (n(v.eff) ?? 100) / 100;
      return [r(T('Production théorique', 'Theoretical output', 'الإنتاج النظري'), th, 't/h'), r(T('Production nette / jour', 'Net output / day', 'الإنتاج الصافي/يوم'), day, 't/j', { main: true }), r(T('Production nette / mois (30 j)', 'Net output / month (30 d)', 'الإنتاج الشهري'), day * 30, 't')];
    },
  },
  {
    id: 'oee', cat: 'production', icon: '⏱️', title: T('Disponibilité & rendement machine', 'Machine availability & yield', 'توافر الآلة والمردود'),
    desc: T('Disponibilité, taux de rebuts et rendement matière.', 'Availability, reject rate and material yield.', 'التوافر ونسبة المرفوضات.'),
    inputs: [
      { key: 'available', label: T('Heures disponibles', 'Available hours', 'الساعات المتاحة'), unit: 'h', def: 720 },
      { key: 'downtime', label: T('Heures d’arrêt', 'Downtime hours', 'ساعات التوقف'), unit: 'h' },
      { key: 'gross', label: T('Production brute', 'Gross production', 'الإنتاج الإجمالي'), unit: 't' },
      { key: 'saleable', label: T('Production vendable', 'Saleable production', 'الإنتاج القابل للبيع'), unit: 't' },
      { key: 'fibre', label: T('Fibre consommée (sèche)', 'Fibre used (dry)', 'الألياف المستهلكة'), unit: 't', def: null },
    ],
    formula: 'Disponibilité = (heures − arrêts) / heures ; Rebuts = (brut − vendable) / brut ; Rendement matière = vendable / fibre',
    compute: (v) => {
      const out = [];
      if (need(v, 'available', 'downtime')) out.push(r(T('Disponibilité', 'Availability', 'التوافر'), (n(v.available) - n(v.downtime)) / n(v.available) * 100, '%', { main: true }));
      if (need(v, 'gross', 'saleable')) { out.push(r(T('Rebuts / casses', 'Rejects / broke', 'المرفوضات'), (n(v.gross) - n(v.saleable)) / n(v.gross) * 100, '%')); out.push(r(T('Tonnes perdues', 'Tonnes lost', 'الأطنان المفقودة'), n(v.gross) - n(v.saleable), 't')); }
      if (need(v, 'saleable', 'fibre')) out.push(r(T('Rendement matière', 'Material yield', 'مردود المادة'), n(v.saleable) / n(v.fibre) * 100, '%'));
      if (need(v, 'available', 'downtime', 'saleable')) out.push(r(T('Cadence nette', 'Net rate', 'المعدل الصافي'), n(v.saleable) / (n(v.available) - n(v.downtime)), 't/h'));
      return out.length ? out : null;
    },
  },
  {
    id: 'reject_cost', cat: 'production', icon: '🗑️', title: T('Coût des rebuts', 'Cost of rejects', 'تكلفة المرفوضات'),
    desc: T('Combien coûtent les casses et ce que rapporte 1 point de moins.', 'What broke costs and the value of 1 point less.', 'تكلفة الفاقد وقيمة خفضه.'),
    inputs: [
      { key: 'gross', label: T('Production brute', 'Gross production', 'الإنتاج الإجمالي'), unit: 't' },
      { key: 'reject_pct', label: T('Taux de rebuts', 'Reject rate', 'نسبة المرفوضات'), unit: '%' },
      { key: 'var_cost', label: T('Coût variable / t', 'Variable cost / t', 'التكلفة المتغيرة/طن'), unit: 'TND', where: T('Production → détail période', 'Production → period detail', 'تفاصيل الفترة') },
    ],
    formula: 'Coût = brut × rebuts% × coût variable ; Gain 1 point = brut × 1% × coût variable',
    compute: (v) => need(v, 'gross', 'reject_pct', 'var_cost') ? [r(T('Tonnes rebutées', 'Rejected tonnes', 'الأطنان المرفوضة'), n(v.gross) * n(v.reject_pct) / 100, 't'), r(T('Coût des rebuts', 'Cost of rejects', 'تكلفة المرفوضات'), n(v.gross) * n(v.reject_pct) / 100 * n(v.var_cost), 'TND', { main: true }), r(T('Gain si −1 point', 'Gain if −1 point', 'المكسب عند −1 نقطة'), n(v.gross) * 0.01 * n(v.var_cost), 'TND', { main: true })] : null,
  },
  {
    id: 'quick_cost', cat: 'production', icon: '🧾', title: T('Coût de revient Jumbo Roll (rapide)', 'Jumbo Roll cost (quick)', 'تكلفة البكرة (سريع)'),
    desc: T('Coût par tonne vendable à partir des grands postes.', 'Cost per saleable tonne from the main cost lines.', 'تكلفة الطن من البنود الرئيسية.'),
    inputs: [
      { key: 'saleable_t', label: T('Tonnage vendable', 'Saleable tonnage', 'الكمية القابلة للبيع'), unit: 't' },
      { key: 'vp_cost_tnd', label: T('Coût pâte vierge', 'Virgin pulp cost', 'تكلفة اللب'), unit: 'TND', def: 0 },
      { key: 'recovered_cost_tnd', label: T('Coût recyclé', 'Recovered cost', 'تكلفة المسترجع'), unit: 'TND', def: 0 },
      { key: 'energy_tnd', label: T('Énergie totale (élec + gaz + vapeur)', 'Total energy', 'الطاقة الإجمالية'), unit: 'TND', def: 0 },
      { key: 'chemicals_tnd', label: T('Chimie', 'Chemicals', 'الكيماويات'), unit: 'TND', def: 0 },
      { key: 'packaging_tnd', label: T('Emballage', 'Packaging', 'التغليف'), unit: 'TND', def: 0 },
      { key: 'labour_tnd', label: T('Main-d’œuvre', 'Labour', 'اليد العاملة'), unit: 'TND', def: 0 },
      { key: 'maintenance_tnd', label: T('Maintenance', 'Maintenance', 'الصيانة'), unit: 'TND', def: 0 },
      { key: 'fixed_overhead_tnd', label: T('Autres frais fixes', 'Other fixed costs', 'مصاريف ثابتة أخرى'), unit: 'TND', def: 0 },
      { key: 'price', label: T('Prix de vente moyen', 'Average selling price', 'متوسط سعر البيع'), unit: 'TND/t', def: null },
      { key: 'margin', label: T('Marge cible', 'Target margin', 'الهامش المستهدف'), unit: '%', ctx: 'target_margin', def: 12 },
    ],
    formula: 'Coût / t = Σ coûts / t vendables ; Point mort = coût complet / t ; Prix cible = point mort / (1 − marge)',
    compute: (v) => {
      if (!need(v, 'saleable_t') || !(n(v.saleable_t) > 0)) return null;
      const p = { saleable_t: n(v.saleable_t), gross_t: 0, rejects_t: 0, downtime_h: 0, available_h: null, vp_t: 0, vp_cost_tnd: n(v.vp_cost_tnd) ?? 0, recovered_t: 0, recovered_cost_tnd: n(v.recovered_cost_tnd) ?? 0, electricity_kwh: 0, electricity_tariff: 0, gas_nm3: 0, gas_tariff: 0, steam_t: 0, steam_cost_tnd_t: 0, cogen_allocation_tnd: n(v.energy_tnd) ?? 0, water_m3: 0, water_tariff: 0, chemicals_tnd: n(v.chemicals_tnd) ?? 0, packaging_tnd: n(v.packaging_tnd) ?? 0, labour_tnd: n(v.labour_tnd) ?? 0, maintenance_tnd: n(v.maintenance_tnd) ?? 0, fixed_overhead_tnd: n(v.fixed_overhead_tnd) ?? 0, variable_overhead_tnd: 0, freight_selling_tnd: 0, avg_selling_price_tnd_t: n(v.price), closing_stock_t: 0 };
      const c = computePeriod(p, n(v.margin) ?? 12);
      const out = [r(T('Coût / t vendable', 'Cost / saleable t', 'التكلفة/طن'), c.cost_per_saleable_t, 'TND', { main: true }), r(T('Part fibre', 'Fibre share', 'حصة الألياف'), c.fibre_pct, '%'), r(T('Part énergie', 'Energy share', 'حصة الطاقة'), c.energy_pct, '%'), r(T('Point mort', 'Break-even', 'نقطة التعادل'), c.break_even_price_tnd_t, 'TND/t'), r(T('Prix cible', 'Target price', 'السعر المستهدف'), c.target_price_tnd_t, 'TND/t', { main: true })];
      if (n(v.price)) out.push(r(T('Marge brute', 'Gross margin', 'الهامش الإجمالي'), c.gross_margin_pct, '%', { tone: c.gross_margin_pct < 0 ? 'bad' : 'ok' }), r(T('Profit de la période', 'Period profit', 'ربح الفترة'), (n(v.price) - c.full_cost_per_t) * n(v.saleable_t), 'TND'));
      return out;
    },
  },

  // ───────── Énergie ─────────
  {
    id: 'energy_t', cat: 'energy', icon: '🔌', title: T('Coût énergie par tonne', 'Energy cost per tonne', 'تكلفة الطاقة للطن'),
    desc: T('Électricité, gaz, vapeur et eau ramenés à la tonne vendable.', 'Electricity, gas, steam and water per saleable tonne.', 'الكهرباء والغاز والبخار للطن.'),
    inputs: [
      { key: 'saleable', label: T('Production vendable', 'Saleable production', 'الإنتاج القابل للبيع'), unit: 't' },
      { key: 'kwh', label: T('Électricité', 'Electricity', 'الكهرباء'), unit: 'kWh', where: T('Compteur STEG', 'STEG meter', 'عداد الستاغ') },
      { key: 'kwh_price', label: T('Tarif électricité', 'Electricity tariff', 'تعريفة الكهرباء'), unit: 'TND/kWh', ctx: 'last_elec' },
      { key: 'gas', label: T('Gaz', 'Gas', 'الغاز'), unit: 'Nm³', def: 0 },
      { key: 'gas_price', label: T('Tarif gaz', 'Gas tariff', 'تعريفة الغاز'), unit: 'TND/Nm³', ctx: 'last_gas', def: 0 },
      { key: 'steam', label: T('Vapeur', 'Steam', 'البخار'), unit: 't', def: 0 },
      { key: 'steam_price', label: T('Coût vapeur', 'Steam cost', 'تكلفة البخار'), unit: 'TND/t', ctx: 'last_steam', def: 0 },
      { key: 'water', label: T('Eau', 'Water', 'المياه'), unit: 'm³', def: 0 },
      { key: 'water_price', label: T('Tarif eau', 'Water tariff', 'تعريفة المياه'), unit: 'TND/m³', ctx: 'last_water', def: 0 },
    ],
    formula: 'Coût énergie / t = (kWh × tarif + Nm³ × tarif + t vapeur × coût + m³ × tarif) / t vendables',
    compute: (v) => {
      if (!need(v, 'saleable', 'kwh') || !(n(v.saleable) > 0)) return null;
      const elec = n(v.kwh) * (n(v.kwh_price) ?? 0), gas = (n(v.gas) ?? 0) * (n(v.gas_price) ?? 0), steam = (n(v.steam) ?? 0) * (n(v.steam_price) ?? 0), water = (n(v.water) ?? 0) * (n(v.water_price) ?? 0);
      const t = n(v.saleable);
      return [r('kWh / t', n(v.kwh) / t, ''), r(T('Gaz / t', 'Gas / t', 'الغاز/طن'), (n(v.gas) ?? 0) / t, 'Nm³'), r(T('Vapeur / t', 'Steam / t', 'البخار/طن'), (n(v.steam) ?? 0) / t, 't'), r(T('Coût énergie total', 'Total energy cost', 'تكلفة الطاقة'), elec + gas + steam + water, 'TND'), r(T('Coût énergie / t', 'Energy cost / t', 'تكلفة الطاقة/طن'), (elec + gas + steam + water) / t, 'TND', { main: true })];
    },
  },
  {
    id: 'energy_saving', cat: 'energy', icon: '🌱', title: T('Économie d’énergie', 'Energy saving', 'توفير الطاقة'),
    desc: T('Gain annuel si on réduit la consommation spécifique (kWh/t).', 'Annual gain from reducing specific consumption (kWh/t).', 'المكسب السنوي من خفض الاستهلاك.'),
    inputs: [
      { key: 'now', label: T('Consommation actuelle', 'Current consumption', 'الاستهلاك الحالي'), unit: 'kWh/t' },
      { key: 'target', label: T('Consommation visée', 'Target consumption', 'الاستهلاك المستهدف'), unit: 'kWh/t' },
      { key: 'tariff', label: T('Tarif', 'Tariff', 'التعريفة'), unit: 'TND/kWh', ctx: 'last_elec' },
      { key: 'tonnes', label: T('Production annuelle', 'Annual production', 'الإنتاج السنوي'), unit: 't' },
      { key: 'invest', label: T('Investissement nécessaire', 'Investment needed', 'الاستثمار المطلوب'), unit: 'TND', def: null },
    ],
    formula: 'Gain = (kWh/t actuel − visé) × tarif × tonnes ; Retour = investissement / gain annuel',
    compute: (v) => {
      if (!need(v, 'now', 'target', 'tariff', 'tonnes')) return null;
      const g = (n(v.now) - n(v.target)) * n(v.tariff) * n(v.tonnes);
      const out = [r(T('kWh économisés / an', 'kWh saved / year', 'ك.و.س الموفرة/سنة'), (n(v.now) - n(v.target)) * n(v.tonnes), 'kWh'), r(T('Gain annuel', 'Annual gain', 'المكسب السنوي'), g, 'TND', { main: true })];
      if (n(v.invest) && g > 0) out.push(r(T('Retour sur investissement', 'Payback', 'فترة الاسترداد'), n(v.invest) / g * 12, T('mois', 'months', 'أشهر')));
      return out;
    },
  },

  // ───────── Prix & finance ─────────
  {
    id: 'price', cat: 'finance', icon: '🏷️', title: T('Prix de vente : plancher, point mort, cible', 'Selling price: floor, break-even, target', 'سعر البيع: الأدنى والتعادل والمستهدف'),
    desc: T('À partir du coût variable et du coût complet par tonne.', 'From variable and full cost per tonne.', 'من التكلفة المتغيرة والكاملة.'),
    inputs: [
      { key: 'var', label: T('Coût variable / t', 'Variable cost / t', 'التكلفة المتغيرة/طن'), unit: 'TND', where: T('Production → détail période', 'Production → period detail', 'تفاصيل الفترة') },
      { key: 'full', label: T('Coût complet / t', 'Full cost / t', 'التكلفة الكاملة/طن'), unit: 'TND' },
      { key: 'margin', label: T('Marge cible', 'Target margin', 'الهامش المستهدف'), unit: '%', ctx: 'target_margin', def: 12 },
      { key: 'price', label: T('Prix proposé / actuel', 'Proposed / current price', 'السعر المقترح'), unit: 'TND/t', def: null },
    ],
    formula: 'Plancher = coût variable ; Point mort = coût complet ; Cible = coût complet / (1 − marge) ; Marge = (prix − coût complet) / prix',
    compute: (v) => {
      if (!need(v, 'var', 'full')) return null;
      const m = (n(v.margin) ?? 12) / 100;
      const out = [r(T('Plancher (court terme)', 'Floor (short term)', 'الحد الأدنى'), n(v.var), 'TND/t'), r(T('Point mort', 'Break-even', 'نقطة التعادل'), n(v.full), 'TND/t'), r(T('Prix cible', 'Target price', 'السعر المستهدف'), n(v.full) / (1 - m), 'TND/t', { main: true })];
      if (n(v.price)) {
        const p = n(v.price);
        out.push(r(T('Marge brute', 'Gross margin', 'الهامش'), (p - n(v.full)) / p * 100, '%', { tone: p < n(v.full) ? 'bad' : p < n(v.full) / (1 - m) ? 'warn' : 'ok' }), r(T('Contribution / t', 'Contribution / t', 'المساهمة/طن'), p - n(v.var), 'TND'));
      }
      return out;
    },
  },
  {
    id: 'volume', cat: 'finance', icon: '📦', title: T('Baisse de prix : volume à vendre en plus', 'Price cut: extra volume needed', 'خفض السعر: الحجم الإضافي'),
    desc: T('Combien vendre en plus pour garder le même profit après une baisse de prix.', 'How much more to sell to keep the same profit after a price cut.', 'كم يجب بيع إضافي للحفاظ على الربح.'),
    inputs: [
      { key: 'price', label: T('Prix actuel', 'Current price', 'السعر الحالي'), unit: 'TND/t' },
      { key: 'cut', label: T('Baisse de prix', 'Price cut', 'خفض السعر'), unit: '%', def: 5 },
      { key: 'var', label: T('Coût variable / t', 'Variable cost / t', 'التكلفة المتغيرة'), unit: 'TND' },
      { key: 'volume', label: T('Volume actuel', 'Current volume', 'الحجم الحالي'), unit: 't' },
    ],
    formula: 'Volume nécessaire = volume × (prix − coût var.) / (prix × (1 − baisse) − coût var.)',
    compute: (v) => {
      if (!need(v, 'price', 'cut', 'var', 'volume')) return null;
      const c0 = n(v.price) - n(v.var), c1 = n(v.price) * (1 - n(v.cut) / 100) - n(v.var);
      if (c1 <= 0) return [r(T('Verdict', 'Verdict', 'الحكم'), T('Prix sous le coût variable : chaque tonne perd de l’argent', 'Price below variable cost: every tonne loses money', 'السعر أقل من التكلفة'), '', { tone: 'bad' })];
      const need2 = n(v.volume) * c0 / c1;
      return [r(T('Volume nécessaire', 'Volume needed', 'الحجم المطلوب'), need2, 't', { main: true }), r(T('Volume en plus', 'Extra volume', 'الحجم الإضافي'), need2 - n(v.volume), 't'), r(T('Hausse de volume', 'Volume increase', 'زيادة الحجم'), (need2 / n(v.volume) - 1) * 100, '%', { main: true })];
    },
  },
  {
    id: 'stock', cat: 'finance', icon: '🏦', title: T('Coût de stockage & délai de paiement', 'Inventory carrying cost & payment terms', 'تكلفة التخزين وأجل الدفع'),
    desc: T('Coût financier d’un stock ou gain d’un délai de paiement plus long.', 'Financing cost of stock or gain from longer payment terms.', 'التكلفة المالية للمخزون.'),
    inputs: [
      { key: 'value', label: T('Valeur (stock ou achat)', 'Value (stock or purchase)', 'القيمة'), unit: 'TND' },
      { key: 'rate', label: T('Coût du capital', 'Cost of capital', 'تكلفة رأس المال'), unit: '%/an', ctx: 'coc', def: 10 },
      { key: 'days', label: T('Jours de stock', 'Days in stock', 'أيام التخزين'), unit: 'j', def: 30 },
      { key: 'pay_days', label: T('Délai de paiement fournisseur', 'Supplier payment terms', 'أجل الدفع'), unit: 'j', def: 0 },
    ],
    formula: 'Coût = valeur × taux × (jours de stock − délai de paiement) / 365',
    compute: (v) => need(v, 'value', 'rate', 'days') ? [r(T('Jours financés', 'Days financed', 'الأيام الممولة'), n(v.days) - (n(v.pay_days) ?? 0), 'j'), r(T('Coût financier', 'Financing cost', 'التكلفة المالية'), n(v.value) * n(v.rate) / 100 * (n(v.days) - (n(v.pay_days) ?? 0)) / 365, 'TND', { main: true }), r(T('Gain de 30 jours de délai en plus', 'Gain from 30 more payment days', 'مكسب 30 يومًا إضافية'), n(v.value) * n(v.rate) / 100 * 30 / 365, 'TND')] : null,
  },
  {
    id: 'savings_target', cat: 'finance', icon: '📈', title: T('Objectif d’économie → effort par tonne', 'Savings target → effort per tonne', 'هدف التوفير ← الجهد للطن'),
    desc: T('Ce que représente un objectif d’économie en TND/t et en % du coût.', 'What a savings target means in TND/t and % of cost.', 'ما يعنيه هدف التوفير للطن.'),
    inputs: [
      { key: 'target', label: T('Objectif d’économie', 'Savings target', 'هدف التوفير'), unit: 'TND', def: 100000 },
      { key: 'tonnes', label: T('Tonnes vendables sur la période', 'Saleable tonnes in the period', 'الأطنان القابلة للبيع'), unit: 't' },
      { key: 'cost', label: T('Coût / t actuel', 'Current cost / t', 'التكلفة الحالية/طن'), unit: 'TND' },
    ],
    formula: 'Effort / t = objectif / tonnes ; % du coût = effort / coût par tonne',
    compute: (v) => need(v, 'target', 'tonnes') ? [r(T('Économie à trouver / t', 'Saving needed / t', 'التوفير المطلوب/طن'), n(v.target) / n(v.tonnes), 'TND', { main: true }), ...(n(v.cost) ? [r(T('Soit en % du coût', 'As % of cost', 'كنسبة من التكلفة'), n(v.target) / n(v.tonnes) / n(v.cost) * 100, '%', { main: true }), r(T('Nouveau coût / t', 'New cost / t', 'التكلفة الجديدة'), n(v.cost) - n(v.target) / n(v.tonnes), 'TND')] : [])] : null,
  },
];

/** Values pre-filled from the company's data (context endpoint + last production period). */
export function contextValue(key, ctx) {
  if (!ctx) return null;
  const refGrade = ctx.vp_reference?.SWL || 'BEKP';
  switch (key) {
    case 'fx_eur': return ctx.fx?.EUR ?? null;
    case 'fx_usd': return ctx.fx?.USD ?? null;
    case 'vp_ref': return ctx.references?.[refGrade] ? Math.round(ctx.references[refGrade].effective_tnd * 100) / 100 : null;
    case 'vp_nominal': return ctx.references?.[refGrade] ? Math.round(ctx.references[refGrade].nominal_tnd_t * 100) / 100 : null;
    case 'target_margin': return ctx.target_margin_pct ?? null;
    case 'coc': return ctx.fin?.cost_of_capital_pct ?? null;
    case 'last_elec': return ctx.last?.electricity_tariff ?? null;
    case 'last_gas': return ctx.last?.gas_tariff ?? null;
    case 'last_steam': return ctx.last?.steam_cost_tnd_t ?? null;
    case 'last_water': return ctx.last?.water_tariff ?? null;
    default: return null;
  }
}
