import type { Ctx, Env } from '../env';

export async function audit(
  env: Env,
  actor: { userId?: number | null; actor: string; ip?: string },
  action: string,
  entity?: string,
  entityId?: string | number | null,
  detail?: unknown,
) {
  await env.DB.prepare(
    'INSERT INTO h360_audit_log (user_id, actor, action, entity, entity_id, detail, ip) VALUES (?,?,?,?,?,?,?)',
  )
    .bind(
      actor.userId ?? null,
      actor.actor,
      action,
      entity ?? null,
      entityId === undefined || entityId === null ? null : String(entityId),
      detail === undefined ? null : JSON.stringify(detail).slice(0, 4000),
      actor.ip ?? null,
    )
    .run();
}

export function auditCtx(c: Ctx, action: string, entity?: string, entityId?: string | number | null, detail?: unknown) {
  return audit(c.env, { userId: c.user?.id, actor: c.user ? `user:${c.user.email}` : 'anonymous', ip: c.ip }, action, entity, entityId, detail);
}
