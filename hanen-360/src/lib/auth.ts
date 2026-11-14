import type { Ctx, Env, Role, User } from '../env';
import { HttpError } from './http';
import { randomToken, sha256, timingSafeEqual } from './crypto';

export const SESSION_COOKIE = '__Host-h360';
export const SESSION_TTL_H = 12;

export const ROLE_RANK: Record<Role, number> = { viewer: 1, analyst: 2, director: 3, admin: 4 };

/** Permission matrix. Directors approve; analysts create data; viewers read. */
export const PERMS = {
  read: ['viewer', 'analyst', 'director', 'admin'],
  write: ['analyst', 'director', 'admin'],
  approve: ['director', 'admin'],
  ai: ['analyst', 'director', 'admin'],
  admin: ['admin'],
} as const satisfies Record<string, readonly Role[]>;
export type Perm = keyof typeof PERMS;

export function can(user: User | null, perm: Perm): boolean {
  return !!user && (PERMS[perm] as readonly string[]).includes(user.role);
}

export function require(c: Ctx, perm: Perm): User {
  if (!c.user || !c.session) throw new HttpError(401, 'Authentification requise');
  if (c.session.mfa_pending) throw new HttpError(401, 'Code MFA requis');
  if (c.user.must_change_password && !c.url.pathname.startsWith('/api/auth/')) {
    throw new HttpError(403, 'Changement de mot de passe requis');
  }
  if (!can(c.user, perm)) throw new HttpError(403, 'Permission insuffisante');
  return c.user;
}

function parseCookies(h: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export async function loadSession(env: Env, req: Request): Promise<Pick<Ctx, 'user' | 'session'>> {
  const token = parseCookies(req.headers.get('Cookie'))[SESSION_COOKIE];
  if (!token) return { user: null, session: null };
  const idHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT s.id_hash, s.csrf, s.mfa_pending, s.expires_at, u.id, u.email, u.name, u.role, u.lang, u.mfa_enabled, u.must_change_password, u.active
       FROM h360_sessions s JOIN h360_users u ON u.id = s.user_id WHERE s.id_hash = ?`,
  ).bind(idHash).first<any>();
  if (!row || !row.active || row.expires_at < new Date().toISOString()) return { user: null, session: null };
  return {
    session: { id_hash: row.id_hash, csrf: row.csrf, mfa_pending: row.mfa_pending },
    user: { id: row.id, email: row.email, name: row.name, role: row.role, lang: row.lang, mfa_enabled: row.mfa_enabled, must_change_password: row.must_change_password },
  };
}

export async function createSession(env: Env, userId: number, req: Request, mfaPending: boolean) {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const expires = new Date(Date.now() + SESSION_TTL_H * 3600_000).toISOString();
  await env.DB.prepare(
    'INSERT INTO h360_sessions (id_hash, user_id, csrf, mfa_pending, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?,?)',
  ).bind(await sha256(token), userId, csrf, mfaPending ? 1 : 0, expires, req.headers.get('CF-Connecting-IP') || '', (req.headers.get('User-Agent') || '').slice(0, 200)).run();
  // opportunistic cleanup of expired sessions
  await env.DB.prepare("DELETE FROM h360_sessions WHERE expires_at < ?").bind(new Date().toISOString()).run();
  return { cookie: sessionCookie(token, SESSION_TTL_H * 3600), csrf };
}

export function sessionCookie(token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

/** CSRF: every state-changing request must echo the per-session token in a header.
 *  Combined with SameSite=Strict cookies and same-origin Origin check. */
export function checkCsrf(c: Ctx) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) return;
  const origin = c.req.headers.get('Origin');
  if (origin && origin !== c.url.origin) throw new HttpError(403, 'Origine refusée');
  if (!c.session) return; // unauthenticated endpoints (login/setup) are rate limited instead
  const t = c.req.headers.get('X-CSRF-Token') || '';
  if (!timingSafeEqual(t, c.session.csrf)) throw new HttpError(403, 'Jeton CSRF invalide');
}

const WINDOW_MIN = 15;
const MAX_FAILS = 5;

export async function checkRateLimit(env: Env, key: string, max = MAX_FAILS) {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString().replace('T', ' ').slice(0, 19);
  const r = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM h360_login_attempts WHERE key = ? AND success = 0 AND created_at > ?',
  ).bind(key, since).first<{ n: number }>();
  if ((r?.n ?? 0) >= max) throw new HttpError(429, `Trop de tentatives. Réessayez dans ${WINDOW_MIN} minutes.`);
}

export async function recordAttempt(env: Env, key: string, success: boolean) {
  await env.DB.prepare('INSERT INTO h360_login_attempts (key, success) VALUES (?,?)').bind(key, success ? 1 : 0).run();
  if (success) await env.DB.prepare('DELETE FROM h360_login_attempts WHERE key = ? AND success = 0').bind(key).run();
}
