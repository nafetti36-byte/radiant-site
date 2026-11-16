import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "mcc_session";
const MAX_AGE_S = 60 * 60 * 12; // 12h

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(email: string) {
  return new SignJWT({ sub: email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(key());
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.sub ? { email: payload.sub } : null;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_S;
