// Renders 3achra social posts to PNG. Run: node posts/src/render.js  (from 3achra/)
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const A = require("./art");
const OUT = path.join(__dirname, "..");
const HTML = path.join(__dirname, "html");

const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=IBM+Plex+Mono:wght@500;600&display=block">`;
const CSS = (W, H, PT, PB) => `
:root{--bg:#f7f6f2;--fg:#17181c;--tag:#e8361f;--muted:#55585f;--line:#e2e0da;--t1:#fde9e5;--t2:#e5f0f8;--t3:#eef5e4;--t4:#f6eddc;
--display:"Archivo Black","Arial Black",system-ui,sans-serif;--body:"IBM Plex Sans","IBM Plex Sans Arabic",Arial,sans-serif;--ar:"IBM Plex Sans Arabic",Tahoma,sans-serif;--mono:"IBM Plex Mono",Menlo,monospace}
*{box-sizing:border-box}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:var(--bg);color:var(--fg);font-family:var(--body)}
.fr{position:absolute;inset:0;padding:${PT}px 88px ${PB}px;display:flex;flex-direction:column;gap:${H>1500?40:28}px}
.hd{display:flex;justify-content:space-between;align-items:center;flex:none}
.logo{font-family:var(--display);font-size:60px;line-height:1;display:flex;align-items:center;gap:18px;letter-spacing:-.01em}
.logo i{font:600 40px/1 var(--mono);font-style:normal;background:var(--tag);color:#fff;padding:8px 14px;border-radius:8px}
.hd .ar{font:700 56px/1 var(--ar);direction:rtl}
.card{flex:1 1 0;min-height:0;border-radius:44px;position:relative;display:flex;align-items:center;justify-content:flex-start;padding:36px}
.card>svg{width:52%;height:100%}
.card.wide>svg{width:100%}
.tag{position:absolute;right:40px;top:50%;margin-top:-118px;transform:rotate(-4deg);background:var(--tag);color:#fff;padding:24px 40px 22px 76px;
  clip-path:polygon(34px 0,100% 0,100% 100%,34px 100%,0 50%);display:flex;flex-direction:column;align-items:flex-start}
.tag::before{content:"";position:absolute;left:38px;top:50%;width:20px;height:20px;margin-top:-10px;border-radius:50%;background:var(--bg)}
.tag b{font-family:var(--display);font-weight:400;font-size:88px;line-height:1}
.tag span{font:600 40px/1.15 var(--mono);letter-spacing:.04em}
.txt{flex:none;display:flex;flex-direction:column;gap:14px}
.lbl{font:600 40px/1 var(--mono);letter-spacing:.08em;color:var(--tag);text-transform:uppercase}
h1{font-family:var(--display);font-weight:400;font-size:92px;line-height:1.02;margin:0;letter-spacing:-.015em;text-wrap:balance}
.fr p{margin:0}
.fr .fx{font-size:44px;line-height:1.28;color:var(--muted);font-weight:500}
.arl{font:600 54px/1.5 var(--ar);direction:rtl;text-align:right}
.ft{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:28px;border-top:6px solid var(--fg);padding-top:28px}
.ft div{display:flex;gap:18px;align-items:center;font:600 40px/1.12 var(--body)}
.ft svg{width:64px;height:64px;flex:none}
/* pack */
.top{flex:none;display:flex;gap:30px;align-items:center}
.top .txt{flex:1}
.top h1{font-size:84px;line-height:.98}
.top .arl{font-size:48px}
.top .ill{width:280px;height:280px;flex:none;border-radius:40px;padding:26px}
.top .ill svg{width:100%;height:100%}
ol{margin:0;padding:22px 40px;list-style:none;background:#fff;border:5px solid var(--fg);border-radius:30px;counter-reset:n;flex:none}
ol li{counter-increment:n;font:500 44px/1.2 var(--body);padding:${H>1500?18:9}px 0;display:flex;gap:24px;align-items:baseline;border-bottom:3px dashed var(--line)}
ol li:last-child{border-bottom:0}
ol li::before{content:counter(n);font:600 40px/1 var(--mono);color:var(--tag);width:30px;flex:none}
.prow{flex:none;display:flex;align-items:center;justify-content:space-between;gap:30px}
.prow .arl{flex:1}
.prow .tag{position:relative;right:auto;top:auto;margin:0;flex:none}
.prow .tag b{font-size:80px}
.prow .arl{font-size:48px;line-height:1.4}
.sp{flex:1 1 0}
`;
const icoCash = `<svg viewBox="0 0 64 64"><rect x="4" y="16" width="56" height="32" rx="6" fill="#eef5e4" stroke="#17181c" stroke-width="5"/><circle cx="32" cy="32" r="8" fill="none" stroke="#17181c" stroke-width="4"/></svg>`;
const icoTruck = `<svg viewBox="0 0 64 64"><rect x="3" y="16" width="36" height="28" rx="4" fill="#e8361f" stroke="#17181c" stroke-width="5"/><path d="M39 24h12l9 10v10H39z" fill="#fff" stroke="#17181c" stroke-width="5" stroke-linejoin="round"/><circle cx="16" cy="48" r="7" fill="#17181c"/><circle cx="48" cy="48" r="7" fill="#17181c"/></svg>`;
const header = `<div class="hd"><div class="logo">3achra <i>9,900</i></div><div class="ar" lang="ar">عشرة</div></div>`;
const footer = (a = ["Paiement", "à la livraison"], b = ["Livraison gratuite", "dès 5 articles"]) =>
  `<div class="ft"><div>${icoCash}<span>${a[0]}<br>${a[1]}</span></div><div>${icoTruck}<span>${b[0]}<br>${b[1]}</span></div></div>`;
const tag9 = `<div class="tag"><span>PRIX UNIQUE</span><b>9,900</b><span>DT · <span lang="ar" style="font-family:var(--ar);letter-spacing:0">كل شي</span></span></div>`;
const page = (W, H, PT, PB, body) => `<!doctype html><html lang="fr"><head><meta charset="utf-8">${FONTS}<style>${CSS(W, H, PT, PB)}</style></head><body><div class="fr">${body}</div></body></html>`;

// ---------- content ----------
const general = [
  { f: "01-launch", lbl: "C'est ouvert", h: "3achra est ouverte&nbsp;!", fx: "Tout à 9,900 DT, livré partout en Tunisie.", ar: "حلّينا! عشرة وصلت، وكل شي بـ 9,900 DT", art: A.bag, tint: "var(--t1)" },
  { f: "02-tout-a-9900", lbl: "Un seul prix", h: "Tout à 9,900&nbsp;DT.", fx: "Cuisine, maison, beauté, téléphone… pas de calcul.", ar: "ما تحسبش، ما تسألش «قدّاش هاذي؟»", art: A.grid6, tint: "#fff" },
  { f: "03-livraison-gratuite-5-articles", lbl: "Livraison", h: "Livraison gratuite dès 5&nbsp;articles", fx: "5 × 9,900 = 49,500 DT, livraison offerte.", ar: "خوذ 5 حوايج ولا أكثر والتوصيل علينا", art: A.truck, tint: "var(--t2)", noTag: true },
  { f: "04-paiement-a-la-livraison", lbl: "Zéro risque", h: "Paiement à la livraison", fx: "Vous voyez le colis, vous payez au livreur.", ar: "ما تخلّص حتى مليم قبل ما توصلك", art: A.cash, tint: "var(--t3)" },
];
const packs = [
  { f: "pack-hiver", name: "Pack Hiver", ar: "باك الشتاء", line: "البرد جا وعشرة حاضرة!", art: A.beanie, tint: "var(--t2)",
    items: ["Chaussettes thermiques ×2 paires", "Bonnet doublé polaire", "Gants tactiles en maille", "Joint isolant fenêtres 2×5 m", "Chaussettes cocooning pilou"] },
  { f: "pack-hijab", name: "Pack Hijab", ar: "باك الحجاب", line: "حوايج الحجاب الكل في باك واحد", art: A.hijabPack, tint: "var(--t1)",
    items: ["Bonnet sous-hijab jersey", "Épingles tête perle ×20", "Pinces crabe 9 cm ×3", "Chouchous satin ×4", "Élastiques fins ×100"] },
  { f: "pack-cuisine", name: "Pack Cuisine", ar: "باك الكوجينة", line: "كوجينتك منظّمة ونظيفة", art: A.pot, tint: "var(--t4)",
    items: ["Éponges grattoir ×10", "Tampons inox spirale ×8", "Sacs zip congélation ×100", "Papier cuisson Air Fryer ×50", "Caissettes gâteaux ×300"] },
  { f: "pack-menage", name: "Pack Ménage", ar: "باك التنظيف", line: "التنظيف الكبير؟ ابدا من هنا", art: A.spray, tint: "var(--t3)",
    items: ["Lavettes microfibre ×5", "Rouleau anti-peluches + 3 rech.", "Éponges magiques ×10", "Filets filtre évier ×100", "Torchons anti-graisse ×3"] },
  { f: "pack-revision", name: "Pack Révision", ar: "باك القراية", line: "الثلاثي الثاني بدا، حضّر روحك!", art: A.study, tint: "var(--t2)",
    items: ["Stylos gel 0,5 mm ×8", "Surligneurs pastel ×6", "Notes adhésives ×6 blocs", "Stylo effaçable + 8 recharges", "Carnet A5 (80 feuilles)"] },
  { f: "pack-ramadan", name: "Pack Ramadan", ar: "باك رمضان", line: "حضّر دارك لرمضان على خاطرك", art: A.ramadan, tint: "var(--t4)",
    items: ["Guirlande « Ramadan Kareem »", "Stickers fenêtre Ramadan ×3", "Corbeille à pain effet rotin", "Étiquettes bocaux ×120", "Caissettes gâteaux ×300"] },
];
const products = [
  { f: "chaussettes-thermiques", lbl: "Hiver", h: "Chaussettes thermiques (lot de 2)", fx: "Polaires et épaisses, pieds au chaud.", ar: "الكارلاج بارد؟ ساقيك يبقاو سخونين", art: A.sock, tint: "var(--t2)" },
  { f: "gants-tactiles", lbl: "Hiver", h: "Gants tactiles en maille", fx: "On garde ses gants, l'écran répond.", ar: "تخدم بالتلفون وإيديك في السخانة", art: A.glove, tint: "var(--t2)" },
  { f: "lot-10-eponges-grattoir", lbl: "Cuisine", h: "Lot 10 éponges grattoir", fx: "Double face : douce et grattante.", ar: "10 سبونجات للماعن، يكفيوك برشا وقت", art: A.sponges, tint: "var(--t4)" },
  { f: "filets-filtre-evier-x100", lbl: "Ménage", h: "Filets filtre évier ×100", fx: "Ils retiennent tout. Fini l'évier bouché.", ar: "ما عادش البالوعة تتسدّ", art: A.sinkNet, tint: "var(--t3)" },
  { f: "papier-cuisson-air-fryer-x50", lbl: "Cuisine", h: "Papier cuisson Air Fryer ×50", fx: "Le panier reste propre, moins de vaisselle.", ar: "الإير فراير يبقى نظيف وما تتعبش في الغسيل", art: A.airfryer, tint: "var(--t1)" },
  { f: "epingles-hijab", lbl: "Hijab", h: "Épingles hijab ×20", fx: "Tête perle, on en perd toujours !", ar: "الشنقالات ديما يضيعو؟ هاك لوط كامل", art: A.hijabPins, tint: "#fff" },
  { f: "verre-trempe-x2", lbl: "Téléphone", h: "Verre trempé 9H ×2", fx: "Un à poser, un de rechange. Précisez votre modèle.", ar: "قلّنا موديل التلفون متاعك وإحنا نبعثولك", art: A.phoneGlass, tint: "var(--t1)" },
  { f: "sacs-poubelle-voiture", lbl: "Auto", h: "Sacs poubelle voiture ×20", fx: "Adhésifs : on les colle où on veut.", ar: "كرهبتك تبقى نظيفة، ما عادش أوراق في كل بلاصة", art: A.carBag, tint: "var(--t2)" },
  { f: "gant-toilettage-chat", lbl: "Animaux", h: "Gant de toilettage chat", fx: "La paire. Une caresse, les poils morts partent.", ar: "تمسّح على قطّوسك والشعر يتنحّى وحدو", art: A.catGlove, tint: "var(--t4)" },
  { f: "lot-5-lavettes-microfibre", lbl: "Ménage", h: "Lot 5 lavettes microfibre", fx: "Absorbantes, sans traces, lavables.", ar: "5 شيفونات ميكروفيبر، ينظّفو بلا أثر", art: A.cloths, tint: "var(--t3)" },
];

// ---------- layouts ----------
function single(d, W, H, PT, PB) {
  return page(W, H, PT, PB, header +
    `<div class="card" style="background:${d.tint}">${A.svg(d.art(), d.vb)}${d.noTag ? `<div class="tag"><span>5 ARTICLES</span><b>49,500</b><span>DT · LIVRÉS</span></div>` : tag9}</div>` +
    `<div class="txt"><div class="lbl">${d.lbl}</div><h1>${d.h}</h1><p class="fx">${d.fx}</p><p class="arl" lang="ar" dir="rtl">${d.ar}</p></div>` + footer());
}
function pack(d, W, H, PT, PB) {
  return page(W, H, PT, PB, header +
    `<div class="top"><div class="txt"><div class="lbl">Pack · 5 articles</div><h1>${d.name}</h1><p class="arl" lang="ar" dir="rtl" style="text-align:left">${d.ar}</p></div><div class="ill" style="background:${d.tint}">${A.svg(d.art())}</div></div>` +
    `<ol>${d.items.map(i => `<li>${i}</li>`).join("")}</ol>` + (H > 1500 ? `<div class="sp"></div>` : "") +
    `<div class="prow"><p class="arl" lang="ar" dir="rtl">${d.line}</p><div class="tag"><span>LES 5</span><b>49,500</b><span>DT</span></div></div>` +
    footer(["Paiement", "à la livraison"], ["Livraison", "gratuite incluse"]));
}

(async () => {
  for (const d of ["feed", "story", "src/html"]) fs.mkdirSync(path.join(OUT, d), { recursive: true });
  const jobs = [];
  for (const d of general) jobs.push(["feed", d.f, single(d, 1080, 1350, 80, 80)]);
  for (const d of packs) jobs.push(["feed", d.f, pack(d, 1080, 1350, 80, 80)]);
  products.forEach((d, i) => jobs.push(["feed", `p${String(i + 1).padStart(2, "0")}-${d.f}`, single(d, 1080, 1350, 80, 80)]));
  for (const d of general.slice(0, 3)) jobs.push(["story", d.f, single(d, 1080, 1920, 240, 300)]);
  jobs.push(["story", "pack-hiver", pack(packs[0], 1080, 1920, 240, 300)]);

  const browser = await chromium.launch();
  const problems = [];
  for (const [dir, name, html] of jobs) {
    const [W, H] = dir === "feed" ? [1080, 1350] : [1080, 1920];
    const file = path.join(HTML, `${dir}-${name}.html`);
    fs.writeFileSync(file, html);
    const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await pg.goto("file://" + file, { waitUntil: "networkidle" }).catch(() => {});
    await pg.evaluate(() => document.fonts.ready);
    const chk = await pg.evaluate(() => {
      const out = [];
      if (!document.fonts.check('40px "Archivo Black"')) out.push("Archivo Black not loaded (fallback used)");
      if (!document.fonts.check('600 40px "IBM Plex Sans Arabic"', "عشرة")) out.push("Plex Arabic not loaded");
      const fr = document.querySelector(".fr");
      if (fr.scrollHeight > fr.clientHeight + 1) out.push(`content overflows by ${fr.scrollHeight - fr.clientHeight}px`);
      const card = document.querySelector(".card");
      if (card && card.clientHeight < 300) out.push(`illustration card only ${card.clientHeight}px tall`);
      for (const el of document.querySelectorAll("h1,.fx,.arl,li,.ft span,.tag")) {
        const r = el.getBoundingClientRect();
        if (r.left < 80 || r.right > innerWidth - 80) out.push(`edge: ${el.className || el.tagName} ${Math.round(r.left)}-${Math.round(r.right)}`);
        if (el.scrollWidth > el.clientWidth + 2 && el.tagName !== "DIV") out.push(`clipped: ${el.textContent.slice(0, 30)}`);
      }
      return out;
    });
    if (chk.length) problems.push(`${dir}/${name}: ${chk.join("; ")}`);
    await pg.screenshot({ path: path.join(OUT, dir, name + ".png") });
    await pg.close();
  }
  // contact sheet
  const feed = jobs.filter(j => j[0] === "feed").map(j => j[1]);
  const cols = 5, tw = 324, th = 405, gap = 24, pad = 48;
  const rows = Math.ceil(feed.length / cols);
  const SW = pad * 2 + cols * tw + (cols - 1) * gap, SH = pad * 2 + 90 + rows * (th + 56) + (rows - 1) * gap;
  const sheet = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>body{margin:0;background:#17181c;color:#f7f6f2;font-family:"IBM Plex Mono",monospace;padding:${pad}px;width:${SW}px;box-sizing:border-box}
h1{font:400 48px "Archivo Black","Arial Black";margin:0 0 42px}h1 small{font:500 26px "IBM Plex Mono";opacity:.7;margin-left:16px}
.g{display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:${gap}px}img{width:${tw}px;height:${th}px;display:block;border-radius:6px}p{margin:10px 0 14px;font-size:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style></head>
<body><h1>3achra · posts feed<small>${feed.length} images · 1080×1350</small></h1><div class="g">${feed.map(n => `<div><img src="../../feed/${n}.png"><p>${n}.png</p></div>`).join("")}</div></body></html>`;
  const sf = path.join(HTML, "contact-sheet.html");
  fs.writeFileSync(sf, sheet);
  const pg = await browser.newPage({ viewport: { width: SW, height: 400 }, deviceScaleFactor: 1 });
  await pg.goto("file://" + sf, { waitUntil: "networkidle" }).catch(() => {});
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: path.join(OUT, "contact-sheet.png"), fullPage: true });
  await browser.close();
  console.log(jobs.length + " images rendered");
  console.log(problems.length ? problems.join("\n") : "no layout problems detected");
})();
