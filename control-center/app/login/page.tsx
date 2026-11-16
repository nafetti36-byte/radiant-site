import { redirect } from "next/navigation";
import { checkCredentials, startSession } from "@/lib/auth.ts";
import { getT } from "@/lib/context.ts";

// Simple in-memory throttle per instance; put a WAF/rate-limit in front in production.
const attempts = new Map<string, { n: number; until: number }>();

async function login(fd: FormData) {
  "use server";
  const email = String(fd.get("email") ?? "");
  const now = Date.now();
  const a = attempts.get(email) ?? { n: 0, until: 0 };
  if (a.until > now) redirect("/login?e=locked");
  if (await checkCredentials(email, String(fd.get("password") ?? ""))) {
    attempts.delete(email);
    await startSession(email.toLowerCase().trim());
    redirect("/");
  }
  a.n += 1;
  if (a.n >= 5) { a.until = now + 15 * 60 * 1000; a.n = 0; }
  attempts.set(email, a);
  redirect("/login?e=1");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { t } = await getT();
  const { e } = await searchParams;
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 16 }}>
      <form action={login} className="card" style={{ width: "100%", maxWidth: 360 }}>
        <h1>Marketing Control Center</h1>
        <p className="muted small">Administrator access only.</p>
        {e && <div className="notice">{e === "locked" ? "Too many attempts. Try again in 15 minutes." : "Invalid credentials."}</div>}
        <label>{t.email}<input name="email" type="email" required autoComplete="username" /></label>
        <label>{t.password}<input name="password" type="password" required autoComplete="current-password" /></label>
        <button className="primary" type="submit" style={{ width: "100%" }}>{t.login}</button>
      </form>
    </div>
  );
}
