import type { Schema } from '../lib/http';

/** Single source of truth for writable entities: used by forms, CRUD API and imports. */
export interface EntitySpec {
  table: string;
  schema: Schema;
  aliases?: Record<string, string[]>; // import column aliases (French/English headers)
  order: string;
  importable?: boolean;
}

const CUR = /^[A-Z]{3}$/;

export const ENTITIES: Record<string, EntitySpec> = {
  suppliers: {
    table: 'h360_suppliers', order: 'name COLLATE NOCASE', importable: true,
    schema: {
      name: { type: 'string', required: true, max: 160 }, country: { type: 'string', max: 80 }, categories: { type: 'string', max: 80 },
      contact_name: { type: 'string', max: 120 }, contact_email: { type: 'string', max: 160, pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ }, contact_phone: { type: 'string', max: 40 },
      payment_terms_days: { type: 'number', min: 0, max: 365, integer: true }, incoterm: { type: 'string', max: 20 },
      quality_rating: { type: 'number', min: 1, max: 5 }, reliability_rating: { type: 'number', min: 1, max: 5 }, notes: { type: 'string', max: 2000 },
      active: { type: 'bool' },
    },
    aliases: { name: ['fournisseur', 'supplier', 'nom', 'raison sociale'], country: ['pays'], payment_terms_days: ['délai paiement', 'delai paiement', 'payment terms'], contact_email: ['email', 'e-mail'], contact_phone: ['téléphone', 'telephone', 'phone'] },
  },
  offers: {
    table: 'h360_offers', order: 'offer_date DESC, id DESC', importable: true,
    schema: {
      supplier_id: { type: 'number', required: true, integer: true, min: 1 },
      category: { type: 'string', required: true, enum: ['virgin_pulp', 'recovered'] },
      grade: { type: 'string', required: true, max: 20, pattern: /^[A-Z0-9_]+$/ },
      offer_date: { type: 'date', required: true }, valid_until: { type: 'date' },
      price: { type: 'number', required: true, min: 0.01, max: 100000 }, currency: { type: 'string', required: true, pattern: CUR },
      incoterm: { type: 'string', max: 20 }, quantity_t: { type: 'number', min: 0, max: 1e6 },
      freight_tnd_t: { type: 'number', min: 0, max: 10000 }, customs_pct: { type: 'number', min: 0, max: 100 }, handling_tnd_t: { type: 'number', min: 0, max: 10000 },
      processing_tnd_t: { type: 'number', min: 0, max: 10000 }, energy_extra_tnd_t: { type: 'number', min: -10000, max: 10000 }, chemicals_extra_tnd_t: { type: 'number', min: -10000, max: 10000 }, other_tnd_t: { type: 'number', min: -10000, max: 10000 },
      moisture_pct: { type: 'number', min: 0, max: 60 }, contamination_pct: { type: 'number', min: 0, max: 60 }, process_loss_pct: { type: 'number', min: 0, max: 80 },
      payment_terms_days: { type: 'number', min: 0, max: 365, integer: true }, brightness_iso: { type: 'number', min: 0, max: 100 },
      status: { type: 'string', enum: ['pending_validation', 'active', 'negotiating', 'accepted', 'rejected', 'expired'] },
      notes: { type: 'string', max: 2000 },
    },
    aliases: { supplier_id: ['fournisseur_id', 'supplier id'], grade: ['qualité', 'qualite', 'sorte'], price: ['prix', 'prix/t', 'price/t'], currency: ['devise'], offer_date: ['date', 'date offre'], valid_until: ['validité', 'validite', 'valable jusqu’au'], quantity_t: ['quantité', 'quantite', 'tonnage', 'qty'], freight_tnd_t: ['fret', 'freight'], customs_pct: ['douane %', 'douane'], moisture_pct: ['humidité', 'humidite', 'moisture'], contamination_pct: ['contaminants', 'impuretés', 'impuretes'], process_loss_pct: ['pertes process', 'pertes', 'losses'] },
  },
  market_prices: {
    table: 'h360_market_prices', order: 'price_date DESC, id DESC', importable: true,
    schema: {
      grade: { type: 'string', required: true, max: 20, pattern: /^[A-Z0-9_]+$/ }, price_date: { type: 'date', required: true },
      price: { type: 'number', required: true, min: 0.01, max: 100000 }, currency: { type: 'string', required: true, pattern: CUR },
      basis: { type: 'string', max: 80 }, source: { type: 'string', required: true, max: 160 }, notes: { type: 'string', max: 1000 },
    },
    aliases: { grade: ['qualité', 'qualite'], price_date: ['date'], price: ['prix'], currency: ['devise'], basis: ['base', 'incoterm'], source: ['source', 'publication'] },
  },
  fx_rates: {
    table: 'h360_fx_rates', order: 'rate_date DESC, id DESC', importable: true,
    schema: {
      currency: { type: 'string', required: true, pattern: CUR }, rate_tnd: { type: 'number', required: true, min: 0.0001, max: 100 },
      rate_date: { type: 'date', required: true }, source: { type: 'string', required: true, max: 120 },
    },
    aliases: { currency: ['devise'], rate_tnd: ['taux', 'cours', 'rate'], rate_date: ['date'], source: ['source'] },
  },
  production: {
    table: 'h360_production_periods', order: 'period_end DESC, id DESC', importable: true,
    schema: {
      machine: { type: 'string', required: true, enum: ['PM1', 'PM2'] }, period_start: { type: 'date', required: true }, period_end: { type: 'date', required: true },
      product_grade: { type: 'string', required: true, max: 60 },
      gross_t: { type: 'number', min: 0, max: 1e6 }, saleable_t: { type: 'number', required: true, min: 0.001, max: 1e6 }, rejects_t: { type: 'number', min: 0, max: 1e6 },
      downtime_h: { type: 'number', min: 0, max: 10000 }, available_h: { type: 'number', min: 0, max: 10000 },
      vp_t: { type: 'number', min: 0, max: 1e6 }, vp_cost_tnd: { type: 'number', min: 0, max: 1e10 }, recovered_t: { type: 'number', min: 0, max: 1e6 }, recovered_cost_tnd: { type: 'number', min: 0, max: 1e10 },
      electricity_kwh: { type: 'number', min: 0, max: 1e10 }, electricity_tariff: { type: 'number', min: 0, max: 10 },
      gas_nm3: { type: 'number', min: 0, max: 1e10 }, gas_tariff: { type: 'number', min: 0, max: 10 },
      steam_t: { type: 'number', min: 0, max: 1e8 }, steam_cost_tnd_t: { type: 'number', min: 0, max: 10000 }, cogen_allocation_tnd: { type: 'number', min: -1e10, max: 1e10 },
      water_m3: { type: 'number', min: 0, max: 1e9 }, water_tariff: { type: 'number', min: 0, max: 100 },
      chemicals_tnd: { type: 'number', min: 0, max: 1e10 }, packaging_tnd: { type: 'number', min: 0, max: 1e10 }, labour_tnd: { type: 'number', min: 0, max: 1e10 },
      maintenance_tnd: { type: 'number', min: 0, max: 1e10 }, fixed_overhead_tnd: { type: 'number', min: 0, max: 1e10 }, variable_overhead_tnd: { type: 'number', min: 0, max: 1e10 },
      freight_selling_tnd: { type: 'number', min: 0, max: 1e10 }, avg_selling_price_tnd_t: { type: 'number', min: 0, max: 100000 }, closing_stock_t: { type: 'number', min: 0, max: 1e6 },
      notes: { type: 'string', max: 2000 },
    },
    aliases: {
      machine: ['machine', 'pm', 'machine papier'], period_start: ['début', 'debut', 'date début', 'date debut', 'du'], period_end: ['fin', 'date fin', 'au'], product_grade: ['grade produit', 'produit', 'grade', 'qualité produit'],
      saleable_t: ['tonnage vendable', 'vendable t', 'vendable', 'saleable', 'tonnes vendables', 'production vendable'], gross_t: ['production brute', 'brut t', 'brut', 'tonnage brut'], rejects_t: ['rebuts', 'casses', 'rebuts t', 'déchets'],
      downtime_h: ['arrêts h', 'arrets h', 'arrêts', 'arrets', 'downtime', 'heures arrêt'], available_h: ['heures disponibles', 'heures dispo'], closing_stock_t: ['stock fin', 'stock final', 'stock fin de période'],
      vp_t: ['pâte vierge t', 'pate vierge t', 'conso pâte vierge', 'pâte vierge consommée'], vp_cost_tnd: ['coût pâte vierge', 'cout pate vierge', 'coût pâte', 'valeur pâte vierge'],
      recovered_t: ['fibres recyclées t', 'fibres recyclees t', 'recyclé t', 'recycle t', 'conso recyclé'], recovered_cost_tnd: ['coût fibres recyclées', 'cout fibres recyclees', 'coût recyclé', 'cout recycle', 'coût vieux papiers'],
      electricity_kwh: ['électricité kwh', 'electricite kwh', 'kwh', 'électricité', 'electricite'], electricity_tariff: ['tarif électricité', 'tarif electricite', 'prix kwh', 'tnd/kwh'],
      gas_nm3: ['gaz nm3', 'gaz', 'nm3'], gas_tariff: ['tarif gaz', 'prix gaz', 'tnd/nm3'], steam_t: ['vapeur t', 'vapeur'], steam_cost_tnd_t: ['coût vapeur', 'cout vapeur', 'prix vapeur'],
      cogen_allocation_tnd: ['cogénération', 'cogeneration', 'allocation cogénération'], water_m3: ['eau m3', 'eau'], water_tariff: ['tarif eau', 'prix eau'],
      chemicals_tnd: ['chimie', 'produits chimiques', 'coût chimie'], packaging_tnd: ['emballage', 'coût emballage'], labour_tnd: ['main d’oeuvre', "main d'oeuvre", 'main-d’œuvre', 'main d oeuvre', 'mo', 'personnel'],
      maintenance_tnd: ['maintenance', 'entretien'], fixed_overhead_tnd: ['frais fixes', 'frais généraux fixes'], variable_overhead_tnd: ['frais variables', 'frais généraux variables'],
      freight_selling_tnd: ['transport vente', 'frais de vente', 'transport et vente'], avg_selling_price_tnd_t: ['prix vente moyen', 'prix moyen', 'prix de vente', 'prix vente'],
    },
  },
  savings: {
    table: 'h360_savings', order: 'id DESC',
    schema: {
      title: { type: 'string', required: true, max: 200 }, category: { type: 'string', required: true, enum: ['fibre', 'energy', 'chemicals', 'yield', 'logistics', 'pricing', 'other'] },
      description: { type: 'string', max: 3000 }, baseline_tnd: { type: 'number', min: 0, max: 1e10 }, projected_tnd: { type: 'number', min: 0, max: 1e10 }, realized_tnd: { type: 'number', min: 0, max: 1e10 },
      status: { type: 'string', enum: ['identified', 'validated', 'in_progress', 'realized', 'rejected'] }, owner: { type: 'string', max: 120 }, due_date: { type: 'date' },
      recommendation_id: { type: 'number', integer: true, min: 1 }, quality_validated: { type: 'bool' },
    },
  },
};

/** Map spreadsheet headers to entity keys (exact key, alias, or normalised label). */
export function mapHeaders(spec: EntitySpec, headers: string[]): (string | null)[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim();
  const lookup = new Map<string, string>();
  for (const k of Object.keys(spec.schema)) { lookup.set(norm(k), k); lookup.set(norm(k.replace(/_/g, ' ')), k); }
  for (const [k, al] of Object.entries(spec.aliases ?? {})) for (const a of al) lookup.set(norm(a), k);
  return headers.map((h) => lookup.get(norm(h)) ?? null);
}
