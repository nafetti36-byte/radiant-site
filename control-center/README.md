# AI Marketing Control Center

Executive marketing platform: CEO dashboard, 20-role AI marketing team (Claude), campaign manager with a 4-advisor approval board, content studio (EN/AR/FR), market intelligence with evidence labels, integrations, scheduled workflows, executive report and audit log. Architecture and test results: `../docs/03-application-architecture.md`.

## Run locally
```bash
cp .env.example .env            # fill DATABASE_URL, ADMIN_EMAIL, SESSION_SECRET, CRON_SECRET
npm install
npm run hash-password -- 'a-long-password'   # paste the escaped .env line
npm run db:migrate && npm run db:seed        # seeds the Radiant brand + 10 disabled workflows only
npm run dev                                   # http://localhost:3000
npm test                                      # unit tests
```
Add `ANTHROPIC_API_KEY` to let agents execute. Without it, tasks are stored as **awaiting credentials** — nothing is simulated.

## Deploy (recommended: Vercel + managed Postgres such as Neon or Supabase)
1. Create the Postgres database; set `DATABASE_URL` (and `DATABASE_SSL=true`).
2. Set env vars from `.env.example` in the host dashboard (the password hash needs no `$` escaping there).
3. Run `npm run db:migrate && npm run db:seed` once against the production DB.
4. `vercel.json` schedules `/api/cron` every 15 minutes (Vercel Pro; Hobby allows daily only). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
5. Enable the workflows you want under **Automations**. They are running only once entries appear in the execution log.
