import "server-only";
import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client.ts";
import { DICTS, LANGS, type Lang } from "./i18n.ts";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value as Lang | undefined;
  return v && (LANGS as readonly string[]).includes(v) ? v : "en";
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: DICTS[lang] };
}

export async function getBrands() {
  return db.select().from(schema.brands).orderBy(asc(schema.brands.id));
}

/** Active brand from cookie, falling back to the first brand. */
export async function getActiveBrand() {
  const id = Number((await cookies()).get("brand")?.value);
  if (id) {
    const [b] = await db.select().from(schema.brands).where(eq(schema.brands.id, id));
    if (b) return b;
  }
  const [first] = await db.select().from(schema.brands).orderBy(asc(schema.brands.id)).limit(1);
  return first ?? null;
}
