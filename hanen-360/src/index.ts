import type { Ctx, Env } from './env';
import { Router } from './router';
import { HttpError, json } from './lib/http';
import { checkCsrf, loadSession } from './lib/auth';
import { authRoutes } from './api/auth';
import { dataRoutes } from './api/data';
import { analysisRoutes } from './api/analysis';
import { importRoutes } from './api/imports';
import { reportRoutes } from './api/reports';
import { aiRoutes } from './api/ai';
import { adminRoutes } from './api/admin';
import { handleScheduled } from './jobs/scheduled';
import { handleEmail } from './jobs/email';

const router = new Router();
authRoutes(router);
// specific routes before generic /:id entity routes
importRoutes(router);
analysisRoutes(router);
reportRoutes(router);
aiRoutes(router);
adminRoutes(router);
dataRoutes(router);
router.get('/api/health', async (c) => {
  const db = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>().then(() => 'ok').catch((e) => `error: ${e.message}`);
  return json({ status: 'ok', db, time: new Date().toISOString(), version: '2.0.0' });
});

export default {
  async fetch(req: Request, env: Env, exec: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    const m = router.match(req.method, url.pathname);
    if (!m) return json({ error: 'Route inconnue' }, 404);
    const c: Ctx = { env, req, url, params: m.params, user: null, session: null, ip: req.headers.get('CF-Connecting-IP') || '0.0.0.0', exec };
    try {
      Object.assign(c, await loadSession(env, req));
      checkCsrf(c);
      return await m.handler(c);
    } catch (e: any) {
      if (e instanceof HttpError) return json({ error: e.message, details: e.details }, e.status);
      if (String(e?.message).includes('no such table')) return json({ error: 'Base non migrée : exécutez `npm run db:migrate:remote`' }, 503);
      console.error('Unhandled', url.pathname, e?.stack || e);
      return json({ error: 'Erreur interne' }, 500);
    }
  },
  async scheduled(event: ScheduledController, env: Env, exec: ExecutionContext) {
    exec.waitUntil(handleScheduled(event, env));
  },
  async email(message: ForwardableEmailMessage, env: Env) {
    await handleEmail(message, env);
  },
} satisfies ExportedHandler<Env>;
