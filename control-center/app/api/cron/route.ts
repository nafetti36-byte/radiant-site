import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDueWorkflows } from "@/lib/workflows.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const results = await runDueWorkflows(new Date());
  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
