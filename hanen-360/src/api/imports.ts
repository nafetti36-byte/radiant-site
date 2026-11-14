import type { Router } from '../router';
import type { Ctx, Env } from '../env';
import { HttpError, file, json, readJson, validate } from '../lib/http';
import { require as requirePerm } from '../lib/auth';
import { audit, auditCtx } from '../lib/audit';
import { parseCsv } from '../lib/csv';
import { readXlsx, writeXlsx } from '../lib/xlsx';
import { sha256 } from '../lib/crypto';
import { ENTITIES, mapHeaders } from './entities';
import { extractQuote } from '../ai/extract';
import { aiConfigured, aiErrorMessage } from '../ai/client';
import { runJob } from '../jobs/runner';
import { RECOVERED_GRADES } from '../engine/data';

const IMPORT_KINDS = ['suppliers', 'offers', 'market_prices', 'fx_rates', 'production'] as const;
const MAX_ROWS = 2000;

async function readTable(f: File): Promise<string[][]> {
  const name = f.name.toLowerCase();
  if (name.endsWith('.xlsx')) return readXlsx(await f.arrayBuffer());
  if (name.endsWith('.csv') || name.endsWith('.txt')) return parseCsv(await f.text());
  if (name.endsWith('.xls')) throw new HttpError(415, 'Format .xls (Excel 97) non supporté : enregistrez en .xlsx ou .csv');
  throw new HttpError(415, 'Formats acceptés : .xlsx, .csv');
}

/** Validates rows against the entity schema; returns staged rows with per-row errors. */
export async function stageRows(env: Env, kind: string, headers: string[], body: unknown[][]) {
  const spec = ENTITIES[kind];
  const map = mapHeaders(spec, headers);
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const supplierCol = kind === 'offers' ? headers.findIndex((h) => ['fournisseur', 'supplier', 'supplier name', 'nom fournisseur'].includes(norm(h))) : -1;
  const suppliers = kind === 'offers' ? new Map((await env.DB.prepare('SELECT id, name FROM h360_suppliers').all<any>()).results.map((s: any) => [norm(s.name), s.id])) : new Map();
  const unmapped = headers.filter((_, i) => map[i] === null && i !== supplierCol);
  const rows = body.slice(0, MAX_ROWS).map((cells, i) => {
    const raw: Record<string, unknown> = {};
    map.forEach((k, ci) => { if (k) raw[k] = cells[ci]; });
    if (supplierCol >= 0 && !raw.supplier_id) {
      const sid = suppliers.get(norm(String(cells[supplierCol] ?? '')));
      raw.supplier_id = sid ?? '';
      if (!sid && cells[supplierCol]) raw.__supplier_error = `fournisseur inconnu « ${cells[supplierCol]} » — créez-le d’abord`;
    }
    if (kind === 'offers' || kind === 'market_prices') { if (raw.grade) raw.grade = String(raw.grade).trim().toUpperCase(); }
    if (kind === 'offers' && !raw.category && raw.grade) raw.category = (RECOVERED_GRADES as readonly string[]).includes(String(raw.grade)) ? 'recovered' : 'virgin_pulp';
    if ((kind === 'offers' || kind === 'market_prices' || kind === 'fx_rates') && raw.currency) raw.currency = String(raw.currency).trim().toUpperCase();
    if (kind === 'production' && raw.machine) raw.machine = String(raw.machine).trim().toUpperCase().replace(/\s/g, '');
    const { value, errors } = validate(spec.schema, raw);
    if (raw.__supplier_error) errors.supplier_id = String(raw.__supplier_error);
    return { row: i + 2, data: value, errors, valid: Object.keys(errors).length === 0 };
  });
  return { rows, unmapped, mapped: map.filter(Boolean) as string[], truncated: body.length > MAX_ROWS };
}

async function saveBatch(env: Env, kind: string, filename: string, source: string, staged: Awaited<ReturnType<typeof stageRows>>, userId: number | null) {
  const valid = staged.rows.filter((r) => r.valid).length;
  const res = await env.DB.prepare("INSERT INTO h360_import_batches (kind, filename, source, status, rows_total, rows_valid, rows_json, created_by) VALUES (?,?,?,'staged',?,?,?,?)")
    .bind(kind, filename, source, staged.rows.length, valid, JSON.stringify({ rows: staged.rows, unmapped: staged.unmapped, mapped: staged.mapped, truncated: staged.truncated }), userId).run();
  return { id: Number(res.meta.last_row_id), rows_total: staged.rows.length, rows_valid: valid, unmapped: staged.unmapped, mapped: staged.mapped, truncated: staged.truncated, preview: staged.rows.slice(0, 50) };
}

async function commitBatch(c: Ctx, batchId: number) {
  const u = c.user!;
  const b = await c.env.DB.prepare('SELECT * FROM h360_import_batches WHERE id=?').bind(batchId).first<any>();
  if (!b) throw new HttpError(404, 'Lot introuvable');
  if (b.status !== 'staged') throw new HttpError(409, 'Lot déjà traité');
  const spec = ENTITIES[b.kind];
  const { rows } = JSON.parse(b.rows_json);
  const stmts: D1PreparedStatement[] = [];
  for (const r of rows.filter((x: any) => x.valid)) {
    const d = { ...r.data } as Record<string, unknown>;
    for (const k of Object.keys(d)) if (d[k] === null) delete d[k];
    if (b.kind === 'market_prices' || b.kind === 'fx_rates') d.source_type = b.source.startsWith('api:') ? 'feed' : 'import';
    if (['offers', 'production', 'suppliers'].includes(b.kind)) { d.source = b.source.startsWith('api:') ? b.source : 'import'; d.source_ref = `batch:${batchId}`; }
    if (b.kind === 'suppliers') delete d.source_ref;
    if (b.kind === 'offers') { d.validated_by = u.id; d.validated_at = new Date().toISOString(); }
    d.created_by = u.id;
    const keys = Object.keys(d);
    stmts.push(c.env.DB.prepare(`INSERT INTO ${spec.table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).bind(...keys.map((k) => d[k])));
  }
  stmts.push(c.env.DB.prepare("UPDATE h360_import_batches SET status='committed', committed_by=?, committed_at=datetime('now') WHERE id=?").bind(u.id, batchId));
  for (let i = 0; i < stmts.length; i += 50) await c.env.DB.batch(stmts.slice(i, i + 50));
  await auditCtx(c, 'import.commit', 'import_batches', batchId, { kind: b.kind, rows: stmts.length - 1 });
  return { inserted: stmts.length - 1 };
}

const FIELD_HELP: Record<string, string> = {
  supplier_id: 'ID fournisseur (ou colonne « fournisseur » avec le nom exact)', category: 'virgin_pulp | recovered', grade: 'NBSK, BEKP, BHKP, SWL, HWS, SOP…',
  currency: 'TND, EUR, USD', price: 'prix nominal par tonne dans la devise', moisture_pct: 'humidité % (pâte séchée à l’air ≈ 10)',
  contamination_pct: 'contaminants / impuretés %', process_loss_pct: 'pertes tri + désencrage + fibres %', rate_tnd: 'TND pour 1 unité de devise',
  machine: 'PM1 | PM2', electricity_tariff: 'TND/kWh', gas_tariff: 'TND/Nm3', steam_cost_tnd_t: 'TND par tonne de vapeur', saleable_t: 'tonnes vendables (obligatoire)',
};

export function importRoutes(r: Router) {
  r.get('/api/imports/template/:kind', async (c) => {
    requirePerm(c, 'read');
    const spec = ENTITIES[c.params.kind];
    if (!spec?.importable) throw new HttpError(404, 'Modèle inconnu');
    const keys = Object.keys(spec.schema);
    const x = writeXlsx([
      { name: c.params.kind, rows: [keys] },
      { name: 'Guide', rows: [['Colonne', 'Obligatoire', 'Type', 'Aide'], ...keys.map((k) => [k, spec.schema[k].required ? 'oui' : 'non', spec.schema[k].type, FIELD_HELP[k] ?? ''])] },
    ]);
    return file(x, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `modele-${c.params.kind}.xlsx`);
  });

  r.post('/api/imports', async (c) => {
    const u = requirePerm(c, 'write');
    const form = await c.req.formData();
    const kind = String(form.get('kind') || '');
    const f = form.get('file');
    if (!(IMPORT_KINDS as readonly string[]).includes(kind)) throw new HttpError(422, 'Type d’import invalide');
    if (!(f instanceof File)) throw new HttpError(422, 'Fichier manquant');
    if (f.size > 5_000_000) throw new HttpError(413, 'Fichier > 5 Mo');
    const table = await readTable(f);
    if (table.length < 2) throw new HttpError(422, 'Le fichier doit contenir une ligne d’en-têtes et au moins une ligne de données');
    const staged = await stageRows(c.env, kind, table[0].map(String), table.slice(1));
    if (!staged.mapped.length) throw new HttpError(422, 'Aucune colonne reconnue — utilisez le modèle Excel fourni');
    const out = await saveBatch(c.env, kind, f.name, `file:${f.name}`, staged, u.id);
    await auditCtx(c, 'import.stage', 'import_batches', out.id, { kind, file: f.name, rows: out.rows_total, valid: out.rows_valid });
    return json(out, 201);
  });

  r.get('/api/imports', async (c) => {
    requirePerm(c, 'read');
    return json((await c.env.DB.prepare('SELECT id, kind, filename, source, status, rows_total, rows_valid, created_at, committed_at FROM h360_import_batches ORDER BY id DESC LIMIT 100').all()).results);
  });
  r.get('/api/imports/:id', async (c) => {
    requirePerm(c, 'read');
    const b = await c.env.DB.prepare('SELECT * FROM h360_import_batches WHERE id=?').bind(Number(c.params.id)).first<any>();
    if (!b) throw new HttpError(404, 'Introuvable');
    return json({ ...b, ...JSON.parse(b.rows_json), rows_json: undefined });
  });
  r.post('/api/imports/:id/commit', async (c) => { requirePerm(c, 'write'); return json(await commitBatch(c, Number(c.params.id))); });
  r.post('/api/imports/:id/reject', async (c) => {
    requirePerm(c, 'write');
    await c.env.DB.prepare("UPDATE h360_import_batches SET status='rejected', committed_by=?, committed_at=datetime('now') WHERE id=? AND status='staged'").bind(c.user!.id, Number(c.params.id)).run();
    await auditCtx(c, 'import.reject', 'import_batches', c.params.id);
    return json({ ok: true });
  });

  // ── Machine-to-machine ingestion (ERP / production / energy exports) with scoped API keys.
  // Data is STAGED, never committed automatically: a user validates the batch.
  r.post('/api/ingest/:kind', async (c) => {
    const auth = c.req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token.startsWith('h360_')) throw new HttpError(401, 'Clé API requise');
    const key = await c.env.DB.prepare('SELECT * FROM h360_api_keys WHERE key_hash=? AND revoked_at IS NULL').bind(await sha256(token)).first<any>();
    if (!key) throw new HttpError(401, 'Clé API invalide');
    const kind = c.params.kind;
    if (!(IMPORT_KINDS as readonly string[]).includes(kind) || !String(key.scopes).split(',').includes(kind)) throw new HttpError(403, 'Portée de la clé insuffisante');
    const b = await readJson<any>(c.req, 2_000_000);
    if (!Array.isArray(b.rows) || !b.rows.length) throw new HttpError(422, 'rows[] requis');
    const headers = [...new Set(b.rows.flatMap((x: any) => Object.keys(x || {})))] as string[];
    const staged = await stageRows(c.env, kind, headers, b.rows.map((x: any) => headers.map((h) => x?.[h] ?? '')));
    const out = await saveBatch(c.env, kind, String(b.filename || `api-${kind}`), `api:${key.name}`, staged, null);
    await c.env.DB.prepare("UPDATE h360_api_keys SET last_used_at=datetime('now') WHERE id=?").bind(key.id).run();
    await c.env.DB.prepare("UPDATE h360_connectors SET status='connected', last_ok_at=datetime('now'), last_check_at=datetime('now'), detail=? WHERE id='erp'").bind(`Dernier envoi: ${kind} (${out.rows_total} lignes) via ${key.name}`).run();
    await audit(c.env, { actor: `apikey:${key.name}`, ip: c.ip }, 'ingest.stage', 'import_batches', out.id, { kind, rows: out.rows_total });
    return json({ batch_id: out.id, rows_total: out.rows_total, rows_valid: out.rows_valid, status: 'staged — validation requise dans Hanen 360' }, 202);
  });

  // ── Supplier quotation PDFs & inbound emails
  r.post('/api/inbound/pdf', async (c) => {
    const u = requirePerm(c, 'write');
    if (!aiConfigured(c.env)) throw new HttpError(503, 'Connexion requise : configurez ANTHROPIC_API_KEY pour l’extraction PDF');
    const form = await c.req.formData();
    const f = form.get('file');
    if (!(f instanceof File) || !f.name.toLowerCase().endsWith('.pdf')) throw new HttpError(422, 'Fichier PDF requis');
    if (f.size > 15_000_000) throw new HttpError(413, 'PDF > 15 Mo');
    const buf = await f.arrayBuffer();
    const hash = await sha256(buf);
    const ins = await c.env.DB.prepare("INSERT INTO h360_inbound_docs (channel, filename, sha256, status, created_by) VALUES ('pdf_upload', ?, ?, 'pending', ?)").bind(f.name.slice(0, 200), hash, u.id).run();
    const docId = Number(ins.meta.last_row_id);
    const res = await runJob(c.env, 'pdf_extraction', 'data_integration', `user:${u.email}`, { doc_id: docId }, () => extractQuote(c.env, { pdf: buf }).catch((e) => { throw new Error(aiErrorMessage(e)); }));
    if (res.ok) await c.env.DB.prepare("UPDATE h360_inbound_docs SET extracted_json=?, status='extracted' WHERE id=?").bind(JSON.stringify(res.output), docId).run();
    await auditCtx(c, 'inbound.pdf_upload', 'inbound_docs', docId, { ok: res.ok });
    if (!res.ok) throw new HttpError(502, res.error || 'Échec extraction');
    return json({ id: docId, extracted: res.output, note: 'Brouillon à valider : aucune offre n’est créée sans votre validation.' }, 201);
  });

  r.get('/api/inbound', async (c) => {
    requirePerm(c, 'read');
    const rows = (await c.env.DB.prepare('SELECT id, channel, sender, subject, filename, status, offer_id, received_at, extracted_json, substr(body_text,1,500) AS excerpt FROM h360_inbound_docs ORDER BY id DESC LIMIT 100').all<any>()).results;
    return json(rows.map((x: any) => ({ ...x, extracted: x.extracted_json ? JSON.parse(x.extracted_json) : null, extracted_json: undefined })));
  });
  r.post('/api/inbound/:id/extract', async (c) => {
    const u = requirePerm(c, 'write');
    const d = await c.env.DB.prepare('SELECT * FROM h360_inbound_docs WHERE id=?').bind(Number(c.params.id)).first<any>();
    if (!d?.body_text) throw new HttpError(404, 'Document sans texte');
    if (!aiConfigured(c.env)) throw new HttpError(503, 'Connexion requise : ANTHROPIC_API_KEY');
    const res = await runJob(c.env, 'email_extraction', 'data_integration', `user:${u.email}`, { doc_id: d.id }, () => extractQuote(c.env, { text: `${d.subject}\n${d.body_text}` }).catch((e) => { throw new Error(aiErrorMessage(e)); }));
    if (!res.ok) throw new HttpError(502, res.error || 'Échec');
    await c.env.DB.prepare("UPDATE h360_inbound_docs SET extracted_json=?, status='extracted' WHERE id=?").bind(JSON.stringify(res.output), d.id).run();
    return json({ extracted: res.output });
  });
  r.post('/api/inbound/:id/convert', async (c) => {
    const u = requirePerm(c, 'write');
    const d = await c.env.DB.prepare('SELECT * FROM h360_inbound_docs WHERE id=?').bind(Number(c.params.id)).first<any>();
    if (!d) throw new HttpError(404, 'Introuvable');
    if (d.status === 'converted') throw new HttpError(409, 'Déjà converti');
    const b = await readJson<any>(c.req);
    const { value, errors } = validate(ENTITIES.offers.schema, b);
    if (Object.keys(errors).length) throw new HttpError(422, 'Données invalides', errors);
    const keys = Object.keys(value).filter((k) => value[k] !== null);
    const extra = { source: d.channel === 'email' ? 'email' : 'pdf', source_ref: `inbound:${d.id}`, created_by: u.id, validated_by: u.id, validated_at: new Date().toISOString() };
    const all = [...keys, ...Object.keys(extra)];
    const ins = await c.env.DB.prepare(`INSERT INTO h360_offers (${all.join(',')}) VALUES (${all.map(() => '?').join(',')})`).bind(...keys.map((k) => value[k]), ...Object.values(extra)).run();
    const offerId = Number(ins.meta.last_row_id);
    await c.env.DB.prepare("UPDATE h360_inbound_docs SET status='converted', offer_id=? WHERE id=?").bind(offerId, d.id).run();
    await auditCtx(c, 'inbound.convert', 'offers', offerId, { inbound: d.id });
    return json({ offer_id: offerId }, 201);
  });
  r.post('/api/inbound/:id/reject', async (c) => {
    requirePerm(c, 'write');
    await c.env.DB.prepare("UPDATE h360_inbound_docs SET status='rejected' WHERE id=?").bind(Number(c.params.id)).run();
    await auditCtx(c, 'inbound.reject', 'inbound_docs', c.params.id);
    return json({ ok: true });
  });
}
