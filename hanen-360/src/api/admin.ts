import type { Router } from '../router';
import { HttpError, json, readJson, file, today } from '../lib/http';
import { require as requirePerm } from '../lib/auth';
import { auditCtx } from '../lib/audit';
import { hashPassword, passwordProblems, randomToken, sha256 } from '../lib/crypto';
import { DEFAULT_SETTINGS, getSettings } from '../lib/settings';
import { runJob } from '../jobs/runner';
import { notify, setConnector, syncPulpFeed, updateFx } from '../jobs/connectors';
import { aiConfigured } from '../ai/client';
import { dailyPipeline, weeklyPipeline } from '../jobs/scheduled';

const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;
const ROLES = ['admin', 'director', 'analyst', 'viewer'];
const IDENT = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;

export function adminRoutes(r: Router) {
  // ── Users & roles
  r.get('/api/admin/users', async (c) => {
    requirePerm(c, 'admin');
    return json((await c.env.DB.prepare('SELECT id, email, name, role, active, mfa_enabled, must_change_password, lang, legacy_ref, created_at, last_login_at FROM h360_users ORDER BY id').all()).results);
  });
  r.post('/api/admin/users', async (c) => {
    requirePerm(c, 'admin');
    const b = await readJson<any>(c.req);
    const email = String(b.email || '').trim().toLowerCase();
    if (!EMAIL.test(email)) throw new HttpError(422, 'Email invalide');
    if (!ROLES.includes(b.role)) throw new HttpError(422, 'Rôle invalide');
    const temp = b.password ? String(b.password) : randomToken(12) + 'Aa1!';
    const pe = passwordProblems(temp); if (pe) throw new HttpError(422, pe);
    const h = await hashPassword(temp);
    const exists = await c.env.DB.prepare('SELECT id FROM h360_users WHERE email=?').bind(email).first();
    if (exists) throw new HttpError(409, 'Un compte existe déjà avec cet email');
    const res = await c.env.DB.prepare('INSERT INTO h360_users (email, name, role, password_hash, password_salt, password_iterations, must_change_password) VALUES (?,?,?,?,?,?,1)')
      .bind(email, String(b.name || email).slice(0, 120), b.role, h.hash, h.salt, h.iterations).run();
    await auditCtx(c, 'users.create', 'user', Number(res.meta.last_row_id), { email, role: b.role });
    return json({ id: Number(res.meta.last_row_id), temporary_password: b.password ? undefined : temp, note: 'Mot de passe temporaire à transmettre par un canal sûr ; changement obligatoire à la première connexion.' }, 201);
  });
  r.put('/api/admin/users/:id', async (c) => {
    const me = requirePerm(c, 'admin');
    const uid = Number(c.params.id);
    const b = await readJson<any>(c.req);
    if (b.role !== undefined && !ROLES.includes(b.role)) throw new HttpError(422, 'Rôle invalide');
    if (uid === me.id && (b.role && b.role !== 'admin' || b.active === 0 || b.active === false)) throw new HttpError(409, 'Vous ne pouvez pas retirer vos propres droits administrateur');
    const sets: string[] = []; const binds: unknown[] = [];
    if (b.role) { sets.push('role=?'); binds.push(b.role); }
    if (b.name) { sets.push('name=?'); binds.push(String(b.name).slice(0, 120)); }
    if (b.active !== undefined) { sets.push('active=?'); binds.push(b.active ? 1 : 0); }
    if (!sets.length) throw new HttpError(422, 'Rien à modifier');
    await c.env.DB.prepare(`UPDATE h360_users SET ${sets.join(',')} WHERE id=?`).bind(...binds, uid).run();
    if (b.active === 0 || b.active === false || b.role) await c.env.DB.prepare('DELETE FROM h360_sessions WHERE user_id=?').bind(uid).run();
    await auditCtx(c, 'users.update', 'user', uid, b);
    return json({ ok: true });
  });
  r.post('/api/admin/users/:id/reset-link', async (c) => {
    const me = requirePerm(c, 'admin');
    const uid = Number(c.params.id);
    const u = await c.env.DB.prepare('SELECT id, email FROM h360_users WHERE id=?').bind(uid).first<any>();
    if (!u) throw new HttpError(404, 'Introuvable');
    const token = randomToken(32);
    await c.env.DB.prepare('INSERT INTO h360_password_resets (token_hash, user_id, created_by, expires_at) VALUES (?,?,?,?)').bind(await sha256(token), uid, me.id, new Date(Date.now() + 3600_000).toISOString()).run();
    await auditCtx(c, 'users.reset_link', 'user', uid);
    return json({ url: `${c.url.origin}/#/reset?token=${token}`, expires_in_minutes: 60, note: 'Lien à usage unique, à transmettre à l’utilisateur par un canal sûr.' });
  });
  r.post('/api/admin/users/:id/mfa-reset', async (c) => {
    requirePerm(c, 'admin');
    await c.env.DB.prepare('UPDATE h360_users SET mfa_enabled=0, mfa_secret=NULL WHERE id=?').bind(Number(c.params.id)).run();
    await auditCtx(c, 'users.mfa_reset', 'user', c.params.id);
    return json({ ok: true });
  });

  // ── Settings (business assumptions)
  r.get('/api/settings', async (c) => { requirePerm(c, 'read'); return json({ values: await getSettings(c.env), defaults: DEFAULT_SETTINGS }); });
  r.put('/api/settings', async (c) => {
    requirePerm(c, 'approve');
    const b = await readJson<Record<string, unknown>>(c.req);
    const stmts: D1PreparedStatement[] = [];
    for (const [k, v] of Object.entries(b)) {
      if (!(k in DEFAULT_SETTINGS)) throw new HttpError(422, `Paramètre inconnu: ${k}`);
      const s = String(v ?? '').trim().slice(0, 300);
      const numeric = /(_pct|_days|_tnd_t|_tnd)$/.test(k) || k.startsWith('quality_equivalence');
      if (numeric && !Number.isFinite(Number(s))) throw new HttpError(422, `${k}: nombre attendu`);
      if (k === 'fx_provider_url' && !/^https:\/\/[^\s]+\{CUR\}/.test(s)) throw new HttpError(422, 'URL https avec {CUR} requise');
      stmts.push(c.env.DB.prepare("INSERT INTO h360_settings (key, value, updated_by, updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_by=excluded.updated_by, updated_at=excluded.updated_at").bind(k, s, c.user!.id));
    }
    if (stmts.length) await c.env.DB.batch(stmts);
    await auditCtx(c, 'settings.update', 'settings', null, b);
    return json({ ok: true });
  });

  // ── Connectors
  r.get('/api/admin/connectors', async (c) => {
    requirePerm(c, 'read');
    const rows = (await c.env.DB.prepare('SELECT * FROM h360_connectors ORDER BY id').all<any>()).results;
    const secrets: Record<string, boolean> = { ai: aiConfigured(c.env), notify: !!c.env.NOTIFY_WEBHOOK_URL, pulp_feed: !!c.env.PULP_FEED_URL, fx: true, email: true, erp: true };
    return json({
      connectors: rows.map((x: any) => ({ ...x, secret_present: secrets[x.id] ?? false, display_status: x.id === 'ai' ? (secrets.ai ? 'connected' : 'Connexion requise') : x.status === 'connected' ? 'connected' : (x.enabled || x.status === 'error') ? x.status : 'Connexion requise' })),
      setup_token_still_set: !!c.env.SETUP_TOKEN,
    });
  });
  r.post('/api/admin/connectors/:id', async (c) => {
    const u = requirePerm(c, 'admin');
    const id = c.params.id;
    const b = await readJson<any>(c.req);
    const conn = await c.env.DB.prepare('SELECT * FROM h360_connectors WHERE id=?').bind(id).first<any>();
    if (!conn) throw new HttpError(404, 'Connecteur inconnu');
    if (b.enabled !== undefined) {
      await c.env.DB.prepare("UPDATE h360_connectors SET enabled=?, status=CASE WHEN ?=0 THEN 'disabled' ELSE status END WHERE id=?").bind(b.enabled ? 1 : 0, b.enabled ? 1 : 0, id).run();
      await auditCtx(c, `connectors.${b.enabled ? 'enable' : 'disable'}`, 'connector', id);
    }
    if (!b.test) return json({ ok: true });
    // Live check — status is only "connected" after a successful real call.
    let res;
    if (id === 'fx') res = await runJob(c.env, 'fx_update', 'currency_risk', `user:${u.email}`, null, () => updateFx(c.env, `user:${u.email}`));
    else if (id === 'pulp_feed') res = await runJob(c.env, 'pulp_feed_sync', 'data_integration', `user:${u.email}`, null, () => syncPulpFeed(c.env));
    else if (id === 'notify') res = await runJob(c.env, 'notify_test', 'reporting_forecasting', `user:${u.email}`, null, async () => { const r = await notify(c.env, 'Hanen 360 : test du canal de notification'); if (!r.sent) throw new Error(r.reason); return r; });
    else if (id === 'ai') {
      res = await runJob(c.env, 'ai_connection_test', 'data_integration', `user:${u.email}`, null, async () => {
        if (!aiConfigured(c.env)) { await setConnector(c.env, 'ai', 'not_configured', 'Connexion requise : secret ANTHROPIC_API_KEY', false); throw new Error('Connexion requise'); }
        const { aiClient, model } = await import('../ai/client');
        const m = await aiClient(c.env).models.retrieve(model(c.env));
        await setConnector(c.env, 'ai', 'connected', `Modèle ${m.id} disponible`, true);
        return { model: m.id };
      });
      if (!res.ok) await setConnector(c.env, 'ai', 'error', res.error || 'échec', false);
    } else res = { ok: false, error: id === 'email' ? 'Le statut se met à jour à la réception du premier email autorisé' : 'Utilisez une clé API d’ingestion ou un import' };
    return json(res);
  });

  // ── API keys for ERP / production / energy system pushes
  r.get('/api/admin/api-keys', async (c) => {
    requirePerm(c, 'admin');
    return json((await c.env.DB.prepare('SELECT id, name, prefix, scopes, created_at, last_used_at, revoked_at FROM h360_api_keys ORDER BY id DESC').all()).results);
  });
  r.post('/api/admin/api-keys', async (c) => {
    const u = requirePerm(c, 'admin');
    const b = await readJson<any>(c.req);
    const scopes = (Array.isArray(b.scopes) ? b.scopes : []).filter((s: string) => ['suppliers', 'offers', 'market_prices', 'fx_rates', 'production'].includes(s));
    if (!scopes.length || !String(b.name || '').trim()) throw new HttpError(422, 'Nom et portées requis');
    const token = 'h360_' + randomToken(30);
    await c.env.DB.prepare('INSERT INTO h360_api_keys (name, key_hash, prefix, scopes, created_by) VALUES (?,?,?,?,?)').bind(String(b.name).slice(0, 80), await sha256(token), token.slice(0, 10), scopes.join(','), u.id).run();
    await auditCtx(c, 'api_keys.create', 'api_key', null, { name: b.name, scopes });
    return json({ key: token, note: 'Affichée une seule fois. Les données envoyées sont mises en attente de validation.' }, 201);
  });
  r.post('/api/admin/api-keys/:id/revoke', async (c) => {
    requirePerm(c, 'admin');
    await c.env.DB.prepare("UPDATE h360_api_keys SET revoked_at=datetime('now') WHERE id=?").bind(Number(c.params.id)).run();
    await auditCtx(c, 'api_keys.revoke', 'api_key', c.params.id);
    return json({ ok: true });
  });

  // ── Jobs, schedules, audit
  r.get('/api/admin/jobs', async (c) => {
    requirePerm(c, 'read');
    const st = c.url.searchParams.get('status');
    return json((await c.env.DB.prepare(`SELECT id, type, agent, status, triggered_by, error, started_at, finished_at, substr(output_json,1,600) AS output FROM h360_jobs ${st ? 'WHERE status=?' : ''} ORDER BY id DESC LIMIT 200`).bind(...(st ? [st] : [])).all()).results);
  });
  r.get('/api/admin/schedules', async (c) => {
    requirePerm(c, 'read');
    const last = async (t: string) => c.env.DB.prepare('SELECT status, started_at, finished_at, error FROM h360_jobs WHERE type=? ORDER BY id DESC LIMIT 1').bind(t).first();
    return json([
      { id: 'daily', cron: '0 5 * * *', label: 'Quotidien 06:00 (Tunis)', steps: ['fx_update (si activé)', 'pulp_feed_sync (si activé)', 'cost_recalculation', 'engine_scan', 'supplier_ranking', 'daily_report'], last: await last('daily_report') },
      { id: 'weekly', cron: '0 6 * * 1', label: 'Lundi 07:00 (Tunis)', steps: ['weekly_report', 'notification (si canal connecté)'], last: await last('weekly_report') },
    ]);
  });
  r.post('/api/admin/schedules/:id/run', async (c) => {
    const u = requirePerm(c, 'approve');
    const res = c.params.id === 'weekly' ? await weeklyPipeline(c.env, `user:${u.email}`) : await dailyPipeline(c.env, `user:${u.email}`);
    await auditCtx(c, 'schedules.run_now', 'schedule', c.params.id);
    return json(res);
  });
  r.get('/api/admin/audit', async (c) => {
    requirePerm(c, 'admin');
    const q = c.url.searchParams.get('q');
    return json((await c.env.DB.prepare(`SELECT * FROM h360_audit_log ${q ? 'WHERE action LIKE ? OR actor LIKE ? OR entity LIKE ?' : ''} ORDER BY id DESC LIMIT 300`).bind(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [])).all()).results);
  });

  // ── Backups: full JSON export of Hanen 360 tables (plus `wrangler d1 export` for full SQL)
  r.get('/api/admin/backup', async (c) => {
    requirePerm(c, 'admin');
    const tables = (await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'h360_%' AND name NOT IN ('h360_sessions','h360_login_attempts','h360_password_resets','h360_d1_migrations')").all<any>()).results.map((t: any) => t.name);
    const out: Record<string, unknown[]> = {};
    for (const t of tables) {
      if (!IDENT.test(t)) continue;
      const rows = (await c.env.DB.prepare(`SELECT * FROM ${t}`).all<any>()).results;
      out[t] = t === 'h360_users' ? rows.map(({ password_hash, password_salt, mfa_secret, ...rest }: any) => rest) : t === 'h360_api_keys' ? rows.map(({ key_hash, ...rest }: any) => rest) : rows;
    }
    await auditCtx(c, 'backup.export', 'database', null, { tables: tables.length });
    return file(JSON.stringify({ exported_at: new Date().toISOString(), note: 'Secrets (hachages de mots de passe, MFA, clés API) exclus', tables: out }), 'application/json', `hanen360-backup-${today()}.json`);
  });

  // ── Existing (pre-v2) data in the same D1 database: read-only discovery and user migration
  r.get('/api/admin/legacy', async (c) => {
    requirePerm(c, 'admin');
    const tables = (await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'h360_%' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'").all<any>()).results;
    const out = [];
    for (const t of tables) {
      if (!IDENT.test(t.name)) continue;
      const cols = (await c.env.DB.prepare(`PRAGMA table_info(${t.name})`).all<any>()).results.map((x: any) => x.name);
      const n = await c.env.DB.prepare(`SELECT COUNT(*) n FROM ${t.name}`).first<{ n: number }>();
      out.push({ table: t.name, columns: cols, rows: n?.n ?? 0 });
    }
    return json(out);
  });
  r.post('/api/admin/legacy/import-users', async (c) => {
    requirePerm(c, 'admin');
    const b = await readJson<any>(c.req);
    const { table, email_column, name_column, role } = b;
    if (![table, email_column].every((x) => IDENT.test(String(x || ''))) || (name_column && !IDENT.test(name_column))) throw new HttpError(422, 'Identifiants invalides');
    if (!ROLES.includes(role)) throw new HttpError(422, 'Rôle invalide');
    const exists = await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? AND name NOT LIKE 'h360_%'").bind(table).first();
    if (!exists) throw new HttpError(404, 'Table introuvable');
    const cols = (await c.env.DB.prepare(`PRAGMA table_info(${table})`).all<any>()).results.map((x: any) => x.name);
    if (!cols.includes(email_column) || (name_column && !cols.includes(name_column))) throw new HttpError(422, 'Colonne introuvable');
    const rows = (await c.env.DB.prepare(`SELECT rowid AS rid, ${email_column} AS email${name_column ? `, ${name_column} AS name` : ''} FROM ${table} LIMIT 500`).all<any>()).results;
    const created: any[] = [];
    for (const row of rows) {
      const email = String(row.email || '').trim().toLowerCase();
      if (!EMAIL.test(email)) continue;
      if (await c.env.DB.prepare('SELECT id FROM h360_users WHERE email=?').bind(email).first()) continue;
      const h = await hashPassword(randomToken(24)); // unusable random password → reset link required
      const ins = await c.env.DB.prepare('INSERT INTO h360_users (email, name, role, password_hash, password_salt, password_iterations, must_change_password, legacy_ref) VALUES (?,?,?,?,?,?,1,?)')
        .bind(email, String(row.name || email).slice(0, 120), role, h.hash, h.salt, h.iterations, `${table}:${row.rid}`).run();
      created.push({ id: Number(ins.meta.last_row_id), email });
    }
    await auditCtx(c, 'legacy.import_users', 'users', null, { table, count: created.length });
    return json({ created, note: 'Les anciens mots de passe ne sont pas réutilisés : générez un lien de réinitialisation pour chaque utilisateur. La table d’origine n’est pas modifiée.' });
  });
}
