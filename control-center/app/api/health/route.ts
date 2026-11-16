import { NextResponse } from "next/server";
import { pool } from "@/db/client.ts";

export const dynamic = "force-dynamic";
export async function GET() {
  try { await pool.query("select 1"); return NextResponse.json({ ok: true, db: "ok" }); }
  catch { return NextResponse.json({ ok: false, db: "error" }, { status: 503 }); }
}
