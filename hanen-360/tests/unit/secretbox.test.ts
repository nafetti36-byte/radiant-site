import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, withStoredAiKey } from '../../src/lib/secretbox';

const KEY = Buffer.alloc(32, 7).toString('base64');
function fakeEnv(row: any, extra: Record<string, string> = {}) {
  return { AI_KEY_ENCRYPTION_KEY: KEY, ...extra, DB: { prepare: () => ({ bind: () => ({ first: async () => row }) }) } } as any;
}

describe('secretbox', () => {
  it('round-trips with AES-GCM and random IVs', async () => {
    const env = fakeEnv(null);
    const a = await encryptSecret(env, 'sk-ant-hello');
    const b = await encryptSecret(env, 'sk-ant-hello');
    expect(a).not.toBe(b);
    expect(a).not.toContain('hello');
    expect(await decryptSecret(env, a)).toBe('sk-ant-hello');
  });
  it('fails with a different encryption key', async () => {
    const enc = await encryptSecret(fakeEnv(null), 'sk-ant-hello');
    await expect(decryptSecret(fakeEnv(null, { AI_KEY_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64') }), enc)).rejects.toThrow();
  });
  it('fills ANTHROPIC_API_KEY from the store only when no secret is set', async () => {
    const enc = await encryptSecret(fakeEnv(null), 'sk-ant-stored');
    const row = { value: JSON.stringify({ enc, hint: 'ored' }) };
    expect((await withStoredAiKey(fakeEnv(row))).ANTHROPIC_API_KEY).toBe('sk-ant-stored');
    expect((await withStoredAiKey(fakeEnv(row, { ANTHROPIC_API_KEY: 'sk-ant-env' }))).ANTHROPIC_API_KEY).toBe('sk-ant-env');
    expect((await withStoredAiKey(fakeEnv(null))).ANTHROPIC_API_KEY).toBeUndefined();
  });
});
