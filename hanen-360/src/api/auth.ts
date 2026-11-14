import type { Router } from '../router';
import type { Ctx } from '../env';
import { HttpError, json, readJson } from '../lib/http';
import { checkRateLimit, createSession, recordAttempt, require as requirePerm, sessionCookie } from '../lib/auth';
import { hashPassword, newTotpSecret, passwordProblems, sha256, timingSafeEqual, verifyPassword, verifyTotp } from '../lib/crypto';
import { audit, auditCtx } from '../lib/audit';

const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;

async function userCount(c: Ctx) {
  return (await c.env.DB.prepare('SELECT COUNT(*) n FROM h360_users').first<{ n: number }>())?.n ?? 0;
}

export function authRoutes(r: Router) {
  r.get('/api/auth/status', async (c) => {
    const n = await userCount(c);
    return json({
      setup_required: n === 0,
      setup_token_configured: !!c.env.SETUP_TOKEN,
      authenticated: !!c.user && !c.session?.mfa_pending,
      mfa_pending: !!c.session?.mfa_pending,
      user: c.user && !c.session?.mfa_pending ? c.user : null,
      csrf: c.session?.csrf ?? null,
    });
  });

  // First administrator activation. Works only while there is no user AND the SETUP_TOKEN secret is set.
  r.post('/api/auth/setup', async (c) => {
    await checkRateLimit(c.env, `setup:${c.ip}`);
    if ((await userCount(c)) > 0) throw new HttpError(409, 'Configuration initiale déjà effectuée');
    if (!c.env.SETUP_TOKEN) throw new HttpError(503, 'Secret SETUP_TOKEN non configuré : `npx wrangler secret put SETUP_TOKEN`');
    const b = await readJson<any>(c.req);
    if (!timingSafeEqual(String(b.token || ''), c.env.SETUP_TOKEN)) { await recordAttempt(c.env, `setup:${c.ip}`, false); throw new HttpError(403, 'Jeton d’activation invalide'); }
    const email = String(b.email || '').trim().toLowerCase();
    if (!EMAIL.test(email)) throw new HttpError(422, 'Email invalide');
    const pwErr = passwordProblems(b.password); if (pwErr) throw new HttpError(422, pwErr);
    const name = String(b.name || '').trim().slice(0, 120) || email;
    const h = await hashPassword(b.password);
    const res = await c.env.DB.prepare('INSERT INTO h360_users (email, name, role, password_hash, password_salt, password_iterations) VALUES (?,?,?,?,?,?)')
      .bind(email, name, 'admin', h.hash, h.salt, h.iterations).run();
    await recordAttempt(c.env, `setup:${c.ip}`, true);
    await audit(c.env, { userId: Number(res.meta.last_row_id), actor: `user:${email}`, ip: c.ip }, 'setup.first_admin', 'user', Number(res.meta.last_row_id));
    return json({ ok: true, next: 'Supprimez maintenant le secret : npx wrangler secret delete SETUP_TOKEN' });
  });

  r.post('/api/auth/login', async (c) => {
    const b = await readJson<any>(c.req);
    const email = String(b.email || '').trim().toLowerCase();
    const key = `login:${email}:${c.ip}`;
    await checkRateLimit(c.env, key);
    await checkRateLimit(c.env, `login-ip:${c.ip}`, 20);
    await checkRateLimit(c.env, `login-acct:${email}`, 10); // across IPs (distributed guessing)
    const u = await c.env.DB.prepare('SELECT * FROM h360_users WHERE email = ?').bind(email).first<any>();
    // constant work even for unknown accounts
    const ok = u ? await verifyPassword(String(b.password || ''), u.password_hash, u.password_salt, u.password_iterations) : (await hashPassword('x'), false);
    if (!u || !ok || !u.active) {
      await recordAttempt(c.env, key, false);
      await recordAttempt(c.env, `login-ip:${c.ip}`, false);
      await recordAttempt(c.env, `login-acct:${email}`, false);
      await audit(c.env, { actor: `anonymous:${email}`, ip: c.ip }, 'auth.login_failed');
      throw new HttpError(401, 'Identifiants invalides');
    }
    await recordAttempt(c.env, key, true);
    await recordAttempt(c.env, `login-acct:${email}`, true);
    const s = await createSession(c.env, u.id, c.req, !!u.mfa_enabled);
    if (!u.mfa_enabled) await c.env.DB.prepare("UPDATE h360_users SET last_login_at=datetime('now') WHERE id=?").bind(u.id).run();
    await audit(c.env, { userId: u.id, actor: `user:${email}`, ip: c.ip }, u.mfa_enabled ? 'auth.password_ok_mfa_pending' : 'auth.login');
    return json({ ok: true, mfa_required: !!u.mfa_enabled, must_change_password: !!u.must_change_password, csrf: s.csrf }, 200, { 'Set-Cookie': s.cookie });
  });

  r.post('/api/auth/mfa', async (c) => {
    if (!c.session || !c.user || !c.session.mfa_pending) throw new HttpError(400, 'Aucune vérification MFA en attente');
    const key = `mfa:${c.user.id}`;
    await checkRateLimit(c.env, key);
    const b = await readJson<any>(c.req);
    const u = await c.env.DB.prepare('SELECT mfa_secret FROM h360_users WHERE id=?').bind(c.user.id).first<any>();
    if (!u?.mfa_secret || !(await verifyTotp(u.mfa_secret, String(b.code || '')))) { await recordAttempt(c.env, key, false); throw new HttpError(401, 'Code invalide'); }
    await recordAttempt(c.env, key, true);
    await c.env.DB.prepare('UPDATE h360_sessions SET mfa_pending=0 WHERE id_hash=?').bind(c.session.id_hash).run();
    await c.env.DB.prepare("UPDATE h360_users SET last_login_at=datetime('now') WHERE id=?").bind(c.user.id).run();
    await auditCtx(c, 'auth.login_mfa');
    return json({ ok: true });
  });

  r.post('/api/auth/logout', async (c) => {
    if (c.session) await c.env.DB.prepare('DELETE FROM h360_sessions WHERE id_hash=?').bind(c.session.id_hash).run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  });

  r.post('/api/auth/password', async (c) => {
    if (!c.user || !c.session || c.session.mfa_pending) throw new HttpError(401, 'Authentification requise');
    const b = await readJson<any>(c.req);
    const u = await c.env.DB.prepare('SELECT * FROM h360_users WHERE id=?').bind(c.user.id).first<any>();
    if (!(await verifyPassword(String(b.current_password || ''), u.password_hash, u.password_salt, u.password_iterations))) throw new HttpError(403, 'Mot de passe actuel incorrect');
    const err = passwordProblems(b.new_password); if (err) throw new HttpError(422, err);
    const h = await hashPassword(b.new_password);
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE h360_users SET password_hash=?, password_salt=?, password_iterations=?, must_change_password=0 WHERE id=?').bind(h.hash, h.salt, h.iterations, c.user.id),
      c.env.DB.prepare('DELETE FROM h360_sessions WHERE user_id=? AND id_hash != ?').bind(c.user.id, c.session.id_hash),
    ]);
    await auditCtx(c, 'auth.password_changed', 'user', c.user.id);
    return json({ ok: true });
  });

  // Password recovery with a one-time token issued by an administrator.
  r.post('/api/auth/reset', async (c) => {
    await checkRateLimit(c.env, `reset:${c.ip}`);
    const b = await readJson<any>(c.req);
    const row = await c.env.DB.prepare('SELECT * FROM h360_password_resets WHERE token_hash=?').bind(await sha256(String(b.token || ''))).first<any>();
    if (!row || row.used_at || row.expires_at < new Date().toISOString()) { await recordAttempt(c.env, `reset:${c.ip}`, false); throw new HttpError(400, 'Lien de réinitialisation invalide ou expiré'); }
    const err = passwordProblems(b.new_password); if (err) throw new HttpError(422, err);
    const h = await hashPassword(b.new_password);
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE h360_users SET password_hash=?, password_salt=?, password_iterations=?, must_change_password=0 WHERE id=?').bind(h.hash, h.salt, h.iterations, row.user_id),
      c.env.DB.prepare("UPDATE h360_password_resets SET used_at=datetime('now') WHERE token_hash=?").bind(row.token_hash),
      c.env.DB.prepare('DELETE FROM h360_sessions WHERE user_id=?').bind(row.user_id),
    ]);
    await audit(c.env, { userId: row.user_id, actor: 'reset-token', ip: c.ip }, 'auth.password_reset', 'user', row.user_id);
    return json({ ok: true });
  });

  r.post('/api/auth/lang', async (c) => {
    const u = requirePerm(c, 'read');
    const b = await readJson<any>(c.req);
    if (!['fr', 'en', 'ar'].includes(b.lang)) throw new HttpError(422, 'Langue invalide');
    await c.env.DB.prepare('UPDATE h360_users SET lang=? WHERE id=?').bind(b.lang, u.id).run();
    return json({ ok: true });
  });

  // Optional TOTP MFA
  r.post('/api/auth/mfa/setup', async (c) => {
    const u = requirePerm(c, 'read');
    const secret = newTotpSecret();
    await c.env.DB.prepare('UPDATE h360_users SET mfa_secret=?, mfa_enabled=0 WHERE id=?').bind(secret, u.id).run();
    const uri = `otpauth://totp/${encodeURIComponent('Hanen 360:' + u.email)}?secret=${secret}&issuer=${encodeURIComponent('Hanen 360')}`;
    return json({ secret, otpauth_uri: uri });
  });
  r.post('/api/auth/mfa/enable', async (c) => {
    const u = requirePerm(c, 'read');
    const b = await readJson<any>(c.req);
    const row = await c.env.DB.prepare('SELECT mfa_secret FROM h360_users WHERE id=?').bind(u.id).first<any>();
    if (!row?.mfa_secret || !(await verifyTotp(row.mfa_secret, String(b.code || '')))) throw new HttpError(422, 'Code invalide');
    await c.env.DB.prepare('UPDATE h360_users SET mfa_enabled=1 WHERE id=?').bind(u.id).run();
    await auditCtx(c, 'auth.mfa_enabled', 'user', u.id);
    return json({ ok: true });
  });
  r.post('/api/auth/mfa/disable', async (c) => {
    const u = requirePerm(c, 'read');
    const b = await readJson<any>(c.req);
    const row = await c.env.DB.prepare('SELECT * FROM h360_users WHERE id=?').bind(u.id).first<any>();
    if (!(await verifyPassword(String(b.password || ''), row.password_hash, row.password_salt, row.password_iterations))) throw new HttpError(403, 'Mot de passe incorrect');
    await c.env.DB.prepare('UPDATE h360_users SET mfa_enabled=0, mfa_secret=NULL WHERE id=?').bind(u.id).run();
    await auditCtx(c, 'auth.mfa_disabled', 'user', u.id);
    return json({ ok: true });
  });
}
