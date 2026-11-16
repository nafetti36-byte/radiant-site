import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, verifySessionToken } from "./session.ts";

export async function currentUser() {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function checkCredentials(email: string, password: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !hash) return false;
  // Always run bcrypt to keep timing uniform.
  const ok = await bcrypt.compare(password, hash);
  return ok && email.toLowerCase().trim() === adminEmail;
}

export async function startSession(email: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(email), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
