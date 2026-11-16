import { db, schema } from "@/db/client.ts";

export async function audit(actor: string, action: string, entityType: string, entityId: string | number | null, brandId: number | null, details: Record<string, unknown> = {}) {
  await db.insert(schema.auditLogs).values({
    actor, action, entityType, entityId: entityId == null ? null : String(entityId), brandId, details,
  });
}

export async function notify(brandId: number | null, title: string, body?: string, link?: string) {
  await db.insert(schema.notifications).values({ brandId, title, body, link });
}
