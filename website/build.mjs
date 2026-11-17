// Static site generator for radiantadvisingservicetn.com
// Reads content/*.json (editable in /admin via Decap CMS) and writes dist/.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "dist");
const read = (f) => JSON.parse(readFileSync(join(root, "content", f), "utf8"));
const S = read("settings.json");
const LANGS = ["en", "ar", "fr"];
const C = Object.fromEntries(LANGS.map((l) => [l, read(`${l}.json`)]));
const LANG_LABEL = { en: "EN", ar: "عربي", fr: "FR" };
const SITE = (S.siteUrl || "").replace(/\/$/, "");
const TODAY = new Date().toISOString().slice(0, 10);

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const base = (l) => (l === "en" ? "/" : `/${l}/`);
const digits = (s) => String(s || "").replace(/[^\d]/g, "");
const PRODUCTS = ["OCC", "SOP", "SWL", "HWS", "LWS", "Virgin pulp", "Jumbo rolls", "Packaging / HORECA", "Other"];

function write(path, html) {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

function layout(l, { title, description, path, body, noindex = false }) {
  const t = C[l];
  const rtl = l === "ar";
  const alternates = LANGS.map((x) => `<link rel="alternate" hreflang="${x}" href="${SITE}${base(x)}${path}">`).join("\n  ");
  const switcher = LANGS.map((x) => `<a href="${base(x)}${path}" hreflang="${x}" lang="${x}"${x === l ? ' aria-current="true"' : ""}>${LANG_LABEL[x]}</a>`).join("");
  const navItems = [["about", "#about"], ["products", "#products"], ["services", "#services"], ["process", "#process"], ["contact", "#contact"]]
    .map(([k, h]) => `<a href="${base(l)}${h}">${esc(t.nav[k])}</a>`).join("");
  const org = {
    "@context": "https://schema.org", "@type": "Organization", name: S.brandName, url: SITE + "/",
    description: C.en.metaDescription, founder: S.ceoName ? { "@type": "Person", name: S.ceoName } : undefined,
    email: S.email || undefined, telephone: S.phone || undefined,
    address: { "@type": "PostalAddress", addressLocality: S.location_en },
    sameAs: S.linkedin ? [S.linkedin] : undefined, areaServed: ["Tunisia", "Saudi Arabia", "GCC", "Europe", "Africa"],
  };
  const wa = digits(S.whatsapp);
  return `<!doctype html>
<html lang="${l}" dir="${rtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${SITE}${base(l)}${path}">\n  ${alternates}\n  <link rel="alternate" hreflang="x-default" href="${SITE}/${path}">`}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}${base(l)}${path}">
  <meta property="og:image" content="${SITE}/assets/og.png">
  <meta property="og:locale" content="${{ en: "en_US", ar: "ar_SA", fr: "fr_FR" }[l]}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#0b0b0f">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="/assets/fonts/${rtl ? "plex-arabic-400.woff2" : "inter-400.woff2"}" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/style.css">
  <script type="application/ld+json">${JSON.stringify(org)}</script>
</head>
<body data-ga="${esc(S.ga4Id || "")}">
  <a class="skip" href="#main">Skip to content</a>
  <header class="topbar">
    <div class="container topbar__inner">
      <a class="brand" href="${base(l)}" aria-label="${esc(S.brandName)}">
        <img src="/assets/logo.svg" width="36" height="36" alt="">
        <span class="brand__name">${esc(S.brandName)}</span>
      </a>
      <nav class="nav" id="nav" aria-label="Main">${navItems}</nav>
      <div class="topbar__end">
        <div class="lang" aria-label="Language">${switcher}</div>
        <a class="btn btn--sm" href="${base(l)}#inquiry">${esc(t.nav.cta)}</a>
        <button class="burger" id="burger" aria-controls="nav" aria-expanded="false" aria-label="Menu"><span></span><span></span><span></span></button>
      </div>
    </div>
  </header>
  <main id="main">
${body}
  </main>
  <footer class="footer">
    <div class="container footer__inner">
      <div class="brand"><img src="/assets/logo.svg" width="28" height="28" alt=""><span>${esc(S.brandName)}</span></div>
      <p>© ${new Date().getFullYear()} ${esc(S.brandName)}. ${esc(t.footer.rights)}</p>
      <p><a href="${base(l)}privacy/">${esc(t.footer.privacy)}</a></p>
    </div>
  </footer>
  ${wa ? `<a class="waFloat" href="https://wa.me/${wa}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.5-.3Z"/></svg></a>` : ""}
  ${S.ga4Id ? `<div class="consent" id="consent" hidden><p>${esc(t.consent.text)} <a href="${base(l)}privacy/">${esc(t.footer.privacy)}</a></p><div><button class="btn btn--ghost btn--sm" data-consent="no">${esc(t.consent.decline)}</button><button class="btn btn--sm" data-consent="yes">${esc(t.consent.accept)}</button></div></div>` : ""}
  <script src="/assets/site.js" defer></script>
</body>
</html>
`;
}

const routeSvg = `<svg class="route" viewBox="0 0 420 300" role="img" aria-label="Trade routes: Europe, Tunisia, GCC, Africa">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#d4af37" stop-opacity=".2"/><stop offset=".5" stop-color="#d4af37"/><stop offset="1" stop-color="#d4af37" stop-opacity=".2"/></linearGradient></defs>
  <g fill="none" stroke="url(#g)" stroke-width="2" stroke-dasharray="6 7">
    <path d="M80 70 Q170 40 200 130"/><path d="M200 130 Q290 90 340 150"/><path d="M200 130 Q180 210 150 245"/><path d="M80 70 Q260 20 340 150"/>
  </g>
  <g font-size="13" font-weight="600" fill="#e9e3cf" text-anchor="middle">
    <circle cx="80" cy="70" r="7" fill="#d4af37"/><text x="80" y="52">Europe</text>
    <circle cx="200" cy="130" r="9" fill="#d4af37"/><circle cx="200" cy="130" r="18" fill="none" stroke="#d4af37" stroke-opacity=".35"/><text x="200" y="166">Tunisia</text>
    <circle cx="340" cy="150" r="7" fill="#d4af37"/><text x="340" y="182">GCC</text>
    <circle cx="150" cy="245" r="7" fill="#d4af37"/><text x="150" y="275">Africa</text>
  </g>
</svg>`;

function home(l) {
  const t = C[l];
  const loc = S[`location_${l}`] || S.location_en;
  const thanks = `${base(l)}thanks/`;
  const prodIcons = [
    '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="14" width="36" height="24" rx="3"/><path d="M6 22h36M6 30h36M18 14v24M30 14v24"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 34c6-14 22-20 28-20-2 8-8 22-22 24"/><path d="M10 34l12-12"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="14" cy="24" rx="7" ry="14"/><path d="M14 10h22c4 0 7 6 7 14s-3 14-7 14H14"/><ellipse cx="14" cy="24" rx="2" ry="4"/></svg>',
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 16l16-8 16 8v18l-16 8-16-8z"/><path d="M8 16l16 8 16-8M24 24v18"/></svg>',
  ];
  const contactRows = [
    S.email && `<li><span>${esc(t.contact.emailLabel)}</span><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li>`,
    S.phone && `<li><span>${esc(t.contact.phoneLabel)}</span><a href="tel:+${digits(S.phone)}" dir="ltr">${esc(S.phone)}</a></li>`,
    S.whatsapp && `<li><span>${esc(t.contact.whatsappLabel)}</span><a href="https://wa.me/${digits(S.whatsapp)}" target="_blank" rel="noopener" dir="ltr">${esc(S.whatsapp)}</a></li>`,
    S.linkedin && `<li><span>${esc(t.contact.linkedinLabel)}</span><a href="${esc(S.linkedin)}" target="_blank" rel="noopener">LinkedIn</a></li>`,
    `<li><span>${esc(t.contact.locationLabel)}</span>${esc(loc)}</li>`,
    S.ceoName && `<li><span>${esc(t.contact.ceoLabel)}</span>${esc(S.ceoName)}</li>`,
  ].filter(Boolean).join("");
  const f = t.inquiry.fields;
  const body = `
    <section class="hero">
      <div class="container hero__grid">
        <div>
          <p class="chip">${esc(t.hero.tag)}</p>
          <h1>${esc(t.hero.title)}</h1>
          <p class="lead">${esc(t.hero.subtitle)}</p>
          <div class="cta">
            <a class="btn" href="#inquiry">${esc(t.hero.ctaPrimary)}</a>
            <a class="btn btn--ghost" href="#products">${esc(t.hero.ctaSecondary)}</a>
          </div>
          ${S.profilePdfUrl ? `<p><a class="link" href="${esc(S.profilePdfUrl)}" download>${esc(t.hero.profile)} →</a></p>` : ""}
          <dl class="facts">${t.facts.map((x) => `<div><dt>${esc(x.num)}</dt><dd>${esc(x.label)}</dd></div>`).join("")}</dl>
        </div>
        <div class="heroCard">
          ${routeSvg}
          <p class="badge">${esc(t.advantage.badge)}</p>
          <h2>${esc(t.advantage.title)}</h2>
          <ul class="checks">${t.advantage.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
        </div>
      </div>
    </section>

    <section class="section" id="about">
      <div class="container">
        <header class="head"><h2>${esc(t.about.title)}</h2><p>${esc(t.about.subtitle)}</p></header>
        <div class="grid2">
          <article class="card"><h3>${esc(t.about.missionTitle)}</h3><p>${esc(t.about.mission)}</p></article>
          <article class="card"><h3>${esc(t.about.whyTitle)}</h3><p>${esc(t.about.why)}</p></article>
        </div>
      </div>
    </section>

    <section class="section section--alt" id="products">
      <div class="container">
        <header class="head"><h2>${esc(t.products.title)}</h2><p>${esc(t.products.subtitle)}</p></header>
        <div class="grid4">${t.products.items.map((p, i) => `
          <article class="card product">${prodIcons[i] ?? ""}<h3>${esc(p.title)}</h3><ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></article>`).join("")}
        </div>
      </div>
    </section>

    <section class="section" id="services">
      <div class="container">
        <header class="head"><h2>${esc(t.services.title)}</h2><p>${esc(t.services.subtitle)}</p></header>
        <div class="grid3">${t.services.items.map((s) => `
          <article class="card"><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p><p class="tag">${esc(s.tag)}</p></article>`).join("")}
        </div>
      </div>
    </section>

    <section class="section section--alt" id="process">
      <div class="container">
        <header class="head"><h2>${esc(t.process.title)}</h2><p>${esc(t.process.subtitle)}</p></header>
        <ol class="steps">${t.process.steps.map((s, i) => `<li><span class="n">${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p></div></li>`).join("")}</ol>
      </div>
    </section>

    <section class="section" id="inquiry">
      <div class="container">
        <header class="head"><h2>${esc(t.inquiry.title)}</h2><p>${esc(t.inquiry.subtitle)}</p></header>
        <div class="grid2 grid2--form">
          <aside class="card"><h3>${esc(t.inquiry.tipsTitle)}</h3><ul class="checks">${t.inquiry.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></aside>
          <form class="card form" name="inquiry" method="POST" action="${thanks}" data-netlify="true" netlify-honeypot="company_website">
            <input type="hidden" name="form-name" value="inquiry"><input type="hidden" name="lang" value="${l}">
            <p class="hp"><label>Leave empty <input name="company_website" tabindex="-1" autocomplete="off"></label></p>
            <div class="row">
              <label>${esc(f.company)}<input name="company" required autocomplete="organization"></label>
              <label>${esc(f.name)}<input name="name" required autocomplete="name"></label>
            </div>
            <div class="row">
              <label>${esc(f.email)}<input name="email" type="email" required autocomplete="email" dir="ltr"></label>
              <label>${esc(f.phone)}<input name="phone" type="tel" autocomplete="tel" dir="ltr"></label>
            </div>
            <div class="row">
              <label>${esc(f.role)}<select name="role"><option value="buyer">${esc(f.roleBuyer)}</option><option value="supplier">${esc(f.roleSupplier)}</option></select></label>
              <label>${esc(f.product)}<select name="product" required>${PRODUCTS.map((p) => `<option>${p}</option>`).join("")}</select></label>
            </div>
            <div class="row row--3">
              <label>${esc(f.volume)}<input name="volume" type="number" min="1" step="1" required inputmode="numeric"></label>
              <label>${esc(f.incoterm)}<select name="incoterm"><option>FOB</option><option>CIF</option><option>CFR</option><option>EXW</option><option>DAP</option></select></label>
              <label>${esc(f.destination)}<input name="destination" required></label>
            </div>
            <label>${esc(f.message)}<textarea name="message" rows="4" placeholder="${esc(f.messagePh)}"></textarea></label>
            <label class="check"><input type="checkbox" name="consent" value="yes" required> <span>${esc(f.consent)}</span></label>
            <button class="btn" type="submit">${esc(f.send)}</button>
          </form>
        </div>
      </div>
    </section>

    <section class="section section--alt" id="contact">
      <div class="container">
        <header class="head"><h2>${esc(t.contact.title)}</h2><p>${esc(t.contact.subtitle)}</p></header>
        <div class="grid2 grid2--form">
          <div class="card"><ul class="contact">${contactRows}</ul></div>
          <form class="card form" name="contact" method="POST" action="${thanks}" data-netlify="true" netlify-honeypot="company_website">
            <input type="hidden" name="form-name" value="contact"><input type="hidden" name="lang" value="${l}">
            <p class="hp"><label>Leave empty <input name="company_website" tabindex="-1" autocomplete="off"></label></p>
            <h3>${esc(t.contact.formTitle)}</h3>
            <div class="row">
              <label>${esc(t.contact.name)}<input name="name" required autocomplete="name"></label>
              <label>${esc(t.contact.email)}<input name="email" type="email" required autocomplete="email" dir="ltr"></label>
            </div>
            <label>${esc(t.contact.message)}<textarea name="message" rows="4" required></textarea></label>
            <label class="check"><input type="checkbox" name="consent" value="yes" required> <span>${esc(f.consent)}</span></label>
            <button class="btn" type="submit">${esc(t.contact.send)}</button>
            <p class="muted small">${esc(t.contact.formNote)}</p>
          </form>
        </div>
      </div>
    </section>`;
  return layout(l, { title: t.metaTitle, description: t.metaDescription, path: "", body });
}

function simple(l, path, title, inner, noindex = false) {
  return layout(l, { title: `${title} | ${S.brandName}`, description: C[l].metaDescription, path, noindex,
    body: `<section class="section page"><div class="container narrow">${inner}</div></section>` });
}

// ── build ──
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "static"), out, { recursive: true });

for (const l of LANGS) {
  const t = C[l], b = base(l);
  write(`${b}index.html`, home(l));
  write(`${b}thanks/index.html`, simple(l, "thanks/", t.thanks.title, `<h1>${esc(t.thanks.title)}</h1><p class="lead">${esc(t.thanks.text)}</p><p><a class="btn" href="${b}">${esc(t.thanks.back)}</a></p>`, true));
  write(`${b}privacy/index.html`, simple(l, "privacy/", t.privacy.title, `<h1>${esc(t.privacy.title)}</h1>${t.privacy.body.map((p) => `<p>${esc(p)}</p>`).join("")}${S.email ? `<p><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></p>` : ""}<p class="muted small">${esc(t.privacy.updated)}: ${TODAY}</p>`));
}
write("404.html", simple("en", "", C.en.notFound.title, LANGS.map((l) => `<div lang="${l}" dir="${l === "ar" ? "rtl" : "ltr"}"><h1>${esc(C[l].notFound.title)}</h1><p>${esc(C[l].notFound.text)}</p><p><a class="btn" href="${base(l)}">${esc(C[l].notFound.back)}</a></p></div>`).join("<hr>"), true));

const urls = LANGS.flatMap((l) => ["", "privacy/"].map((p) => `${SITE}${base(l)}${p}`));
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `User-agent: *\nDisallow: /admin/\nDisallow: /thanks/\nSitemap: ${SITE}/sitemap.xml\n`);

if (!existsSync(join(out, "assets/og.png"))) console.warn("note: assets/og.png missing (social preview image)");
console.log(`Built ${LANGS.length} languages → dist/`);
