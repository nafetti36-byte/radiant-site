/** Bundled into netlify/functions/*.mjs by scripts/build-netlify.mjs */
import { webcrypto } from 'node:crypto';
import * as nodeBuffer from 'node:buffer';
import { getStore } from '@netlify/blobs';

// Older Node runtimes (18) lack these Web globals that the Worker code relies on.
const g = globalThis as any;
if (!g.crypto) g.crypto = webcrypto;
if (!g.File && (nodeBuffer as any).File) g.File = (nodeBuffer as any).File;
import { handleCron, handleRequest } from './handler';
import type { BlobLike } from './store';

declare const Netlify: { env: { get(k: string): string | undefined } };
const store = () => getStore({ name: 'hanen360', consistency: 'strong' }) as unknown as BlobLike;
const get = (k: string) => Netlify.env.get(k);

export async function api(req: Request): Promise<Response> {
  try { return await handleRequest(req, store(), get); }
  catch (e: any) { console.error(e); return new Response(JSON.stringify({ error: e?.message || 'Erreur interne' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }
}
export const daily = () => handleCron('0 5 * * *', store(), get).then(() => new Response('ok'));
export const weekly = () => handleCron('0 6 * * 1', store(), get).then(() => new Response('ok'));
