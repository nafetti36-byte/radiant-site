import type { Router } from '../router';
import { HttpError, file, json, readJson, round, today } from '../lib/http';
import { require as requirePerm } from '../lib/auth';
import { auditCtx } from '../lib/audit';
import { reportPdf, reportXlsx, storeReport } from '../jobs/reports';
import { runJob } from '../jobs/runner';
import { listEntity } from './data';
import { ENTITIES } from './entities';
import { costingPeriods, fibreAnalysis } from '../engine/data';
import { writeXlsx } from '../lib/xlsx';
import { toCsv } from '../lib/csv';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function reportRoutes(r: Router) {
  r.get('/api/reports', async (c) => {
    requirePerm(c, 'read');
    return json((await c.env.DB.prepare('SELECT id, kind, period_label, created_by, created_at FROM h360_reports ORDER BY id DESC LIMIT 100').all()).results);
  });
  r.post('/api/reports', async (c) => {
    const u = requirePerm(c, 'write');
    const b = await readJson<any>(c.req);
    const kind = ['daily', 'weekly', 'adhoc'].includes(b.kind) ? b.kind : 'adhoc';
    const res = await runJob(c.env, `${kind}_report`, 'reporting_forecasting', `user:${u.email}`, null, () => storeReport(c.env, kind, `user:${u.email}`));
    if (!res.ok) throw new HttpError(500, res.error || 'Échec');
    await auditCtx(c, 'reports.generate', 'reports', res.output!.id);
    return json({ id: res.output!.id, label: res.output!.label }, 201);
  });
  r.get('/api/reports/:id', async (c) => {
    requirePerm(c, 'read');
    const rep = await c.env.DB.prepare('SELECT * FROM h360_reports WHERE id=?').bind(Number(c.params.id)).first<any>();
    if (!rep) throw new HttpError(404, 'Introuvable');
    const data = JSON.parse(rep.data_json);
    const fmt = c.url.searchParams.get('format');
    await auditCtx(c, 'reports.download', 'reports', rep.id, { format: fmt || 'json' });
    if (fmt === 'pdf') return file(reportPdf(rep.period_label, data), 'application/pdf', `hanen360-rapport-${rep.id}.pdf`);
    if (fmt === 'xlsx') return file(reportXlsx(data), XLSX, `hanen360-rapport-${rep.id}.xlsx`);
    return json({ ...rep, data, data_json: undefined });
  });

  // Generic exports for every module table and analysis
  r.get('/api/export/:dataset', async (c) => {
    requirePerm(c, 'read');
    const ds = c.params.dataset;
    let rows: Record<string, unknown>[];
    if (ENTITIES[ds]) rows = await listEntity(c, ds);
    else if (ds === 'fibre_analysis') {
      const f = await fibreAnalysis(c.env);
      rows = (f.offers as any[]).map((o) => ({ offre: o.id, fournisseur: o.supplier_name, categorie: o.category, grade: o.grade, date: o.offer_date, prix: o.price, devise: o.currency, taux_tnd: o.fx_tnd, statut: o.status, validation: o.validation_status, qualite: o.quality_status, rendement_pct: round((o.cost?.usable_yield ?? 0) * 100, 2), cout_rendu_tnd_t: round(o.cost?.landed_tnd_t, 2), cout_effectif_tnd_t_utile: round(o.cost?.effective_tnd_per_usable_t, 2), reference: o.reference?.source, prix_max: round(o.negotiation?.max_price, 2), prix_cible: round(o.negotiation?.target_price, 2), economie_tnd_t: round(o.negotiation?.expected_savings_tnd_t, 2), economie_tnd: round(o.negotiation?.expected_savings_tnd, 0), erreur: o.error ?? o.missing ?? '' }));
    } else if (ds === 'costing') {
      rows = (await costingPeriods(c.env, { limit: 500 })).map((p: any) => ({ id: p.id, machine: p.machine, debut: p.period_start, fin: p.period_end, grade: p.product_grade, vendable_t: p.saleable_t, ...(p.result ? Object.fromEntries([['cout_t', round(p.result.cost_per_saleable_t, 2)], ['cout_complet_t', round(p.result.full_cost_per_t, 2)], ['cout_variable_t', round(p.result.variable_cost_per_t, 2)], ['fibre_pct', round(p.result.fibre_pct, 2)], ['energie_pct', round(p.result.energy_pct, 2)], ['kwh_t', round(p.result.kwh_per_t, 1)], ['marge_brute_pct', round(p.result.gross_margin_pct, 2)], ['point_mort_t', round(p.result.break_even_price_tnd_t, 2)], ['prix_cible_t', round(p.result.target_price_tnd_t, 2)], ['valeur_stock_tnd', round(p.result.inventory_value_tnd, 0)], ...p.result.lines.map((l: any) => [`${l.key}_tnd_t`, round(l.tnd_t, 2)])]) : { erreur: p.error }) }));
    } else if (ds === 'recommendations') {
      rows = (await c.env.DB.prepare("SELECT id, module, type, title, summary, savings_tnd, confidence, status, decision_note, created_by, created_at, decided_at FROM h360_recommendations WHERE status!='superseded' ORDER BY id DESC").all<any>()).results;
    } else if (ds === 'audit') {
      requirePerm(c, 'admin');
      rows = (await c.env.DB.prepare('SELECT * FROM h360_audit_log ORDER BY id DESC LIMIT 5000').all<any>()).results;
    } else throw new HttpError(404, 'Jeu de données inconnu');
    await auditCtx(c, 'export', ds, null, { rows: rows.length });
    const headers = rows.length ? Object.keys(rows[0]) : ['aucune_donnee'];
    const matrix = [headers, ...rows.map((r) => headers.map((h) => r[h] as any))];
    if (c.url.searchParams.get('format') === 'csv') return file(toCsv(matrix), 'text/csv; charset=utf-8', `hanen360-${ds}-${today()}.csv`);
    return file(writeXlsx([{ name: ds, rows: matrix }]), XLSX, `hanen360-${ds}-${today()}.xlsx`);
  });
}
