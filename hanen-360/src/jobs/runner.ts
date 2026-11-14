import type { Env } from '../env';

/** Every automated or AI task runs through here, so the UI only shows an agent as
 *  "active" while a real job row is in status `running`. */
export async function runJob<T>(env: Env, type: string, agent: string | null, triggeredBy: string, input: unknown, fn: () => Promise<T>): Promise<{ job_id: number; ok: boolean; output?: T; error?: string }> {
  const res = await env.DB.prepare("INSERT INTO h360_jobs (type, agent, status, triggered_by, input_json) VALUES (?,?,'running',?,?)")
    .bind(type, agent, triggeredBy, input === undefined ? null : JSON.stringify(input).slice(0, 4000)).run();
  const id = Number(res.meta.last_row_id);
  try {
    const output = await fn();
    await env.DB.prepare("UPDATE h360_jobs SET status='succeeded', output_json=?, finished_at=datetime('now') WHERE id=?")
      .bind(JSON.stringify(output ?? null).slice(0, 20000), id).run();
    return { job_id: id, ok: true, output };
  } catch (e: any) {
    await env.DB.prepare("UPDATE h360_jobs SET status='failed', error=?, finished_at=datetime('now') WHERE id=?")
      .bind(String(e?.message ?? e).slice(0, 2000), id).run();
    return { job_id: id, ok: false, error: String(e?.message ?? e) };
  }
}

/** Jobs stuck in `running` (e.g. Worker evicted) are marked failed after 15 minutes. */
export async function reapStaleJobs(env: Env) {
  await env.DB.prepare("UPDATE h360_jobs SET status='failed', error='interrompu (timeout)', finished_at=datetime('now') WHERE status='running' AND started_at < datetime('now','-15 minutes')").run();
}
