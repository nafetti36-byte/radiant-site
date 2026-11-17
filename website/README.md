# radiantadvisingservicetn.com

Static, three-language website (English `/`, Arabic `/ar/`, French `/fr/`) for Radiant Advising Services.

- **Edit text & contact details:** `content/en.json`, `ar.json`, `fr.json`, `settings.json` — or online at `/admin` (Decap CMS; needs Netlify Identity + Git Gateway enabled on the Netlify site).
- **Build:** `node build.mjs` → `dist/` (Netlify runs this automatically via `/netlify.toml`).
- **Forms:** Netlify Forms (`inquiry`, `contact`) with spam honeypot → submissions in Netlify → Forms; turn on email notifications there.
- **Analytics:** set `ga4Id` in `settings.json`; GA4 loads only after the visitor accepts the consent banner, and inquiry submits fire a `generate_lead` event.
- Contact rows (email, phone, WhatsApp, LinkedIn) and the WhatsApp button only appear once filled in `settings.json` — no placeholders are ever shown.
