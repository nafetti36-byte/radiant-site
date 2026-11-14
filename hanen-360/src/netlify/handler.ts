/** Netlify Functions entry: runs the Hanen 360 Worker unchanged on top of the D1 facade. */
import worker from '../index';
import type { Env } from '../env';
import { withDatabase, type BlobLike } from './store';

const ENV_KEYS = ['APP_ENV', 'AI_MODEL', 'SETUP_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'NOTIFY_WEBHOOK_URL', 'PULP_FEED_URL', 'PULP_FEED_TOKEN', 'FX_API_BASE'] as const;

export function envFrom(get: (k: string) => string | undefined, db: unknown): Env {
  const env: Record<string, unknown> = { DB: db, ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) }, AI_MODEL: 'claude-opus-5-5', APP_ENV: 'production' };
  for (const k of ENV_KEYS) { const v = get(k); if (v) env[k] = v; }
  return env as unknown as Env;
}

export async function handleRequest(req: Request, store: BlobLike, get: (k: string) => string | undefined, waitUntil?: (p: Promise<unknown>) => void): Promise<Response> {
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();
  const pending: Promise<unknown>[] = [];
  const res = await withDatabase(store, async (d1) => {
    const r = new Request(req.url, { method: req.method, headers: req.headers, body });
    const out = await worker.fetch(r, envFrom(get, d1), { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext);
    await Promise.all(pending.splice(0)); // background work must hit the DB before it is saved
    return out;
  });
  void waitUntil;
  return res;
}

export async function handleCron(cron: string, store: BlobLike, get: (k: string) => string | undefined) {
  await withDatabase(store, async (d1) => {
    const pending: Promise<unknown>[] = [];
    await worker.scheduled!({ cron, scheduledTime: Date.now(), noRetry() {} } as unknown as ScheduledController, envFrom(get, d1), { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext);
    await Promise.all(pending);
  });
}
