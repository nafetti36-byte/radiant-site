/** AES-256-GCM encryption for secrets stored in the database (e.g. the AI key pasted by
 *  an administrator). The encryption key lives only in the AI_KEY_ENCRYPTION_KEY env var. */
import type { Env } from '../env';
import { b64, unb64 } from './crypto';

const SECRET_KEY = 'secret_anthropic_api_key';

async function key(env: Env) {
  if (!env.AI_KEY_ENCRYPTION_KEY) throw new Error('AI_KEY_ENCRYPTION_KEY non configuré');
  const raw = unb64(env.AI_KEY_ENCRYPTION_KEY);
  if (raw.length !== 32) throw new Error('AI_KEY_ENCRYPTION_KEY doit faire 32 octets (base64)');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(env: Env, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), new TextEncoder().encode(plain));
  return `v1:${b64(iv)}:${b64(ct)}`;
}

export async function decryptSecret(env: Env, stored: string): Promise<string> {
  const [v, iv, ct] = stored.split(':');
  if (v !== 'v1') throw new Error('format inconnu');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await key(env), unb64(ct));
  return new TextDecoder().decode(pt);
}

export const storedKeyAvailable = (env: Env) => !!env.AI_KEY_ENCRYPTION_KEY;

export async function saveAiKey(env: Env, apiKey: string, userId: number) {
  const enc = await encryptSecret(env, apiKey);
  await env.DB.prepare("INSERT INTO h360_settings (key, value, updated_by, updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_by=excluded.updated_by, updated_at=excluded.updated_at")
    .bind(SECRET_KEY, JSON.stringify({ enc, hint: apiKey.slice(-4) }), userId).run();
}
export async function deleteAiKey(env: Env) {
  await env.DB.prepare('DELETE FROM h360_settings WHERE key = ?').bind(SECRET_KEY).run();
}
export async function aiKeyInfo(env: Env): Promise<{ hint: string; updated_at: string } | null> {
  const r = await env.DB.prepare('SELECT value, updated_at FROM h360_settings WHERE key = ?').bind(SECRET_KEY).first<any>();
  if (!r) return null;
  return { hint: JSON.parse(r.value).hint, updated_at: r.updated_at };
}

/** Returns env with ANTHROPIC_API_KEY filled from the encrypted store when not set as a secret. */
export async function withStoredAiKey(env: Env): Promise<Env> {
  if (env.ANTHROPIC_API_KEY || !env.AI_KEY_ENCRYPTION_KEY) return env;
  try {
    const r = await env.DB.prepare('SELECT value FROM h360_settings WHERE key = ?').bind(SECRET_KEY).first<any>();
    if (!r) return env;
    return { ...env, ANTHROPIC_API_KEY: await decryptSecret(env, JSON.parse(r.value).enc) };
  } catch { return env; }
}
export const SECRET_SETTING_PREFIX = 'secret_';
