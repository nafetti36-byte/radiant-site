// Flat vector illustrations for 3achra posts. All drawn in a 400x400 box.
// Palette: ink, price-tag red, white, plus the site's soft tints.
const C = { ink:"#17181c", tag:"#e8361f", w:"#ffffff", bg:"#f7f6f2", t1:"#fde9e5", t2:"#e5f0f8", t3:"#eef5e4", t4:"#f6eddc", mid:"#3a3c44" };
let uid = 0;
const id = p => `${p}${++uid}`;
// Union outline trick: draw shapes once with a thick ink stroke, then again without stroke on top.
const U = (s, sw = 16) => `<g stroke="${C.ink}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${s}</g><g stroke="none">${s}</g>`;
const L = (s, sw = 8, col = C.ink) => `<g fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${s}</g>`;
const svg = (inner, vb = "0 0 400 400") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
const place = (inner, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
const badge = (txt, x = 330, y = 70, r = 54) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.ink}"/><text x="${x}" y="${y + 13}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="${txt.length > 3 ? 32 : 38}" fill="${C.w}">${txt}</text>`;

function sockShape(fill, accent) {
  const cid = id("sk");
  const d = "M120 40 H230 V215 L318 262 Q350 280 335 312 Q318 342 282 326 L150 262 Q120 247 120 212 Z";
  return `<defs><clipPath id="${cid}"><path d="${d}"/></clipPath></defs>` +
    U(`<path d="${d}" fill="${fill}"/>`) +
    `<g clip-path="url(#${cid})"><rect x="100" y="30" width="150" height="62" fill="${accent}"/><circle cx="345" cy="320" r="52" fill="${accent}"/><circle cx="118" cy="245" r="40" fill="${accent}"/></g>` +
    L(`<path d="${d}"/>`, 14) + L(`<path d="M140 50v30M162 50v30M184 50v30M206 50v30"/>`, 6, fill);
}
const sock = () => place(sockShape(C.tag, C.w), -30, 30, 0.95) + place(sockShape(C.w, C.tag), 70, 10, 0.95);

function glove(withPhone = true) {
  const phone = withPhone ? U(`<rect x="235" y="40" width="130" height="240" rx="24" fill="${C.ink}"/>`) + `<rect x="249" y="56" width="102" height="200" rx="12" fill="${C.t2}"/>` + L(`<path d="M270 100h60M270 130h40"/>`, 8, C.w) : "";
  const parts = `<rect x="104" y="185" width="44" height="120" rx="22" fill="${C.w}" transform="rotate(-38 126 290)"/>
   <rect x="122" y="88" width="44" height="150" rx="22" fill="${C.w}"/><rect x="166" y="64" width="44" height="160" rx="22" fill="${C.w}"/>
   <rect x="210" y="74" width="44" height="150" rx="22" fill="${C.w}"/><rect x="254" y="104" width="40" height="130" rx="20" fill="${C.w}"/>
   <rect x="122" y="170" width="172" height="150" rx="40" fill="${C.w}"/><rect x="132" y="300" width="152" height="74" rx="12" fill="${C.tag}"/>`;
  return phone + U(parts) +
    `<path d="M166 86a22 22 0 0 1 44 0v16h-44z" fill="${C.tag}"/><path d="M210 96a22 22 0 0 1 44 0v16h-44z" fill="${C.tag}"/>` +
    L(`<path d="M166 160v50M210 160v50M254 170v40"/>`, 6) + L(`<path d="M156 312v52M184 312v52M212 312v52M240 312v52M266 312v52"/>`, 6, C.w);
}

function sponge(x, y, rot) {
  return `<g transform="rotate(${rot} ${x + 130} ${y + 35})">` +
    U(`<rect x="${x}" y="${y}" width="260" height="78" rx="16" fill="${C.t4}"/>`) +
    `<rect x="${x}" y="${y}" width="260" height="28" rx="12" fill="${C.tag}"/>` + L(`<path d="M${x} ${y + 28}h260"/>`, 6) +
    [0, 1, 2, 3, 4, 5].map(i => `<circle cx="${x + 30 + i * 40}" cy="${y + 54}" r="6" fill="#d9c9a8"/>`).join("") +
    L(`<rect x="${x}" y="${y}" width="260" height="78" rx="16"/>`, 12) + `</g>`;
}
const sponges = () => sponge(70, 280, -3) + sponge(70, 196, 2) + sponge(70, 112, -2) + badge("×10", 330, 70);

function sinkNet() {
  const pid = id("mesh");
  return `<defs><pattern id="${pid}" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 11h22M11 0v22" stroke="${C.ink}" stroke-width="3" opacity=".55"/></pattern></defs>` +
    U(`<path d="M86 150 Q90 336 200 352 Q310 336 314 150 Z" fill="${C.w}"/>`) +
    `<path d="M86 150 Q90 336 200 352 Q310 336 314 150 Z" fill="url(#${pid})"/>` +
    `<circle cx="170" cy="300" r="14" fill="${C.tag}"/><circle cx="214" cy="316" r="11" fill="${C.ink}"/><circle cx="240" cy="292" r="9" fill="${C.tag}"/>` +
    U(`<ellipse cx="200" cy="150" rx="118" ry="34" fill="${C.t2}"/>`, 14) +
    `<ellipse cx="200" cy="150" rx="118" ry="34" fill="none" stroke="${C.tag}" stroke-width="18"/>` + L(`<ellipse cx="200" cy="150" rx="128" ry="44"/><ellipse cx="200" cy="150" rx="108" ry="24"/>`, 5) +
    badge("×100", 340, 300, 56);
}

function liner(x, y, s) {
  return place(U(`<path d="M80 150 L320 150 L290 330 Q200 352 110 330 Z" fill="${C.t4}"/>`) +
    L(`<path d="M130 172 L140 322M175 176 L178 336M222 176 L220 336M268 172 L260 322"/>`, 6, "#c9b48c") +
    U(`<ellipse cx="200" cy="150" rx="120" ry="34" fill="${C.w}"/>`, 14) +
    [[160, 146], [200, 140], [240, 146], [180, 160], [220, 160]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="6" fill="#d9c9a8"/>`).join(""), x, y, s);
}
const airfryer = () => liner(10, 120, 0.85) + liner(80, 30, 0.85) + badge("×50", 330, 320, 56);

function pins(n = 6, ox = 0, oy = 0) {
  const cols = [C.tag, C.w, C.ink, C.tag, C.w, C.tag];
  let s = "";
  for (let i = 0; i < n; i++) {
    const x1 = 90 + i * 42 + ox, y1 = 90 + oy, x2 = x1 + 70, y2 = 340 + oy;
    s += L(`<path d="M${x1} ${y1} L${x2} ${y2}"/>`, 7, C.ink) + U(`<circle cx="${x1}" cy="${y1}" r="24" fill="${cols[i % 6]}"/>`, 10) +
      `<circle cx="${x1 - 8}" cy="${y1 - 8}" r="6" fill="${cols[i % 6] === C.w ? C.t1 : "#ffffff"}" opacity=".7"/>`;
  }
  return s;
}
const hijabPins = () => U(`<path d="M40 250 Q120 200 200 240 T360 230 L360 380 L40 380 Z" fill="${C.t1}"/>`, 12) + pins(6, 0, -20);

function phoneGlass() {
  const glass = (x, y, r) => `<g transform="rotate(${r} ${x + 80} ${y + 150})">` + U(`<rect x="${x}" y="${y}" width="160" height="290" rx="28" fill="${C.w}" fill-opacity=".85"/>`, 10) +
    L(`<path d="M${x + 30} ${y + 120} L${x + 100} ${y + 50}M${x + 40} ${y + 170} L${x + 130} ${y + 80}"/>`, 10, C.t2) + `<circle cx="${x + 80}" cy="${y + 22}" r="7" fill="${C.ink}" opacity=".5"/></g>`;
  return U(`<rect x="50" y="60" width="176" height="316" rx="30" fill="${C.ink}"/>`) + `<rect x="64" y="76" width="148" height="284" rx="18" fill="${C.t2}"/>` +
    L(`<path d="M90 130h90M90 165h60"/>`, 10, C.w) + glass(200, 40, 6) + glass(170, 70, -3) + badge("×2", 340, 360, 46);
}

function carBag() {
  return U(`<rect x="70" y="200" width="230" height="200" rx="40" fill="${C.ink}"/>`) +
    `<rect x="122" y="140" width="16" height="70" fill="${C.mid}"/><rect x="232" y="140" width="16" height="70" fill="${C.mid}"/>` +
    U(`<rect x="90" y="40" width="190" height="112" rx="44" fill="${C.ink}"/>`) + L(`<path d="M130 80h110"/>`, 8, C.mid) +
    L(`<path d="M240 170 Q290 160 300 205"/>`, 10) +
    U(`<path d="M250 205 L350 205 L340 360 Q300 378 260 360 Z" fill="${C.tag}"/>`) + L(`<path d="M262 232h80"/>`, 6, C.w) +
    U(`<rect x="300" y="40" width="70" height="90" rx="14" fill="${C.t4}"/><ellipse cx="335" cy="40" rx="35" ry="12" fill="${C.w}"/>`, 10);
}

function catGlove() {
  const cat = U(`<path d="M250 268 L262 180 L306 230 Z" fill="${C.ink}"/><path d="M368 268 L356 180 L312 230 Z" fill="${C.ink}"/><circle cx="309" cy="290" r="78" fill="${C.ink}"/>`, 12) +
    `<ellipse cx="282" cy="282" rx="12" ry="16" fill="${C.w}"/><ellipse cx="336" cy="282" rx="12" ry="16" fill="${C.w}"/><path d="M300 312 h18 l-9 10 z" fill="${C.tag}"/>` +
    L(`<path d="M260 318 l-36 -6M262 330 l-34 6M358 318 l36 -6M356 330 l34 6"/>`, 5, C.ink);
  const mitt = U(`<ellipse cx="72" cy="220" rx="30" ry="64" fill="${C.w}" transform="rotate(-28 72 220)"/><path d="M90 330 V160 Q90 70 175 70 Q260 70 260 160 V330 Z" fill="${C.w}"/><rect x="86" y="310" width="178" height="60" rx="12" fill="${C.ink}"/>`);
  let dots = "";
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) dots += `<circle cx="${125 + c * 34 + (r % 2) * 14}" cy="${125 + r * 38}" r="10" fill="${C.tag}"/>`;
  return cat + mitt + dots + `<rect x="200" y="326" width="56" height="28" rx="8" fill="${C.tag}"/>` + L(`<path d="M50 120 q10 -14 20 0 M30 160 q10 -14 20 0"/>`, 5);
}

function cloths() {
  const cols = [C.tag, C.t2, C.w, C.ink, C.t4];
  return cols.map((c, i) => { const y = 300 - i * 52, x = 70 + (i % 2) * 14;
    return U(`<rect x="${x}" y="${y}" width="260" height="62" rx="14" fill="${c}"/>`, 12) + L(`<path d="M${x + 180} ${y + 6} v50"/>`, 5, c === C.ink ? C.mid : "#00000022"); }).join("") + badge("×5", 330, 70, 50);
}

// ---------- pack and general illustrations ----------
function beanie() {
  return U(`<circle cx="200" cy="80" r="40" fill="${C.w}"/><path d="M80 270 Q80 110 200 110 Q320 110 320 270 Z" fill="${C.tag}"/><rect x="66" y="250" width="268" height="80" rx="20" fill="${C.w}"/>`) +
    L(`<path d="M110 260v60M150 260v60M190 260v60M230 260v60M270 260v60M300 260v60"/>`, 6, C.t4) + L(`<path d="M150 140 Q140 200 150 250M250 140 Q260 200 250 250M200 115v135"/>`, 6, "#b42512") +
    L(`<path d="M345 330v60M319 345l52 30M319 375l52 -30"/>`, 8) + L(`<path d="M45 90v44M26 101l38 22M26 123l38 -22"/>`, 7);
}
function scrunchie(cx, cy) {
  return `<circle cx="${cx}" cy="${cy}" r="68" fill="none" stroke="${C.ink}" stroke-width="60"/><circle cx="${cx}" cy="${cy}" r="68" fill="none" stroke="${C.tag}" stroke-width="44"/>` +
    L(Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M${cx + Math.cos(a) * 52} ${cy + Math.sin(a) * 52} L${cx + Math.cos(a) * 84} ${cy + Math.sin(a) * 84}"/>`; }).join(""), 5, "#b42512");
}
const hijabPack = () => U(`<path d="M20 300 Q120 250 200 290 T380 280 L380 390 L20 390 Z" fill="${C.t1}"/>`, 12) + place(pins(4, 0, 0), 150, -40, 0.75) + scrunchie(120, 150);
function pot() {
  return L(`<path d="M150 90 q-20 -30 0 -60M200 90 q-20 -30 0 -60M250 90 q-20 -30 0 -60"/>`, 9) +
    U(`<rect x="40" y="200" width="60" height="30" rx="14" fill="${C.ink}"/><rect x="300" y="200" width="60" height="30" rx="14" fill="${C.ink}"/><path d="M80 170 H320 V320 Q320 360 280 360 H120 Q80 360 80 320 Z" fill="${C.tag}"/><path d="M66 172 Q200 100 334 172 Z" fill="${C.w}"/><rect x="176" y="110" width="48" height="26" rx="12" fill="${C.ink}"/>`) +
    L(`<path d="M110 220 h180"/>`, 8, C.w);
}
function spray() {
  return U(`<path d="M150 70 H280 L320 110 L292 122 L262 104 H240 V150 H190 V104 H150 Z" fill="${C.ink}"/><rect x="170" y="140" width="90" height="40" rx="8" fill="${C.w}"/><path d="M150 180 H280 Q300 180 300 210 V350 Q300 375 275 375 H155 Q130 375 130 350 V210 Q130 180 150 180 Z" fill="${C.tag}"/><path d="M196 118 Q160 150 172 190" fill="none"/>`) +
    `<rect x="160" y="240" width="110" height="80" rx="10" fill="${C.w}"/>` + L(`<path d="M180 265h70M180 295h46"/>`, 7, C.t2) +
    L(`<path d="M330 92h30M326 70l26 -14M326 116l26 14"/>`, 7);
}
function study() {
  return `<g transform="rotate(-6 200 220)">` + U(`<rect x="70" y="70" width="230" height="290" rx="16" fill="${C.w}"/>`) +
    L(`<path d="M110 140h150M110 180h150M110 220h150M110 260h110"/>`, 6, C.t2) + L(`<path d="M70 100h-22M70 150h-22M70 200h-22M70 250h-22M70 300h-22"/>`, 10) + `</g>` +
    `<g transform="rotate(36 300 220)">` + U(`<rect x="275" y="70" width="52" height="250" rx="8" fill="${C.tag}"/><path d="M275 320 L301 372 L327 320 Z" fill="${C.t4}"/><rect x="275" y="50" width="52" height="34" rx="10" fill="${C.t1}"/>`, 12) +
    `<path d="M292 355 L301 372 L310 355 Z" fill="${C.ink}"/></g>`;
}
function ramadan() {
  const cid = id("moon");
  return `<defs><mask id="${cid}"><rect width="400" height="400" fill="#fff"/><circle cx="150" cy="110" r="88" fill="#000"/></mask></defs>` +
    `<circle cx="110" cy="140" r="96" fill="${C.ink}" mask="url(#${cid})"/><circle cx="110" cy="140" r="86" fill="${C.tag}" mask="url(#${cid})"/>` +
    L(`<path d="M270 20 V70"/>`, 8) + U(`<path d="M240 70 H300 L320 100 H220 Z" fill="${C.ink}"/><path d="M220 100 H320 L340 160 V280 L320 330 H220 L200 280 V160 Z" fill="${C.ink}"/><path d="M230 330 H310 L296 360 H244 Z" fill="${C.ink}"/>`) +
    `<path d="M228 120 H312 L324 165 V275 L310 312 H230 L216 275 V165 Z" fill="${C.t4}"/>` + L(`<path d="M270 120 V312M216 215 H324"/>`, 8) +
    `<circle cx="270" cy="215" r="20" fill="${C.tag}"/>` + star(70, 320, 18) + star(150, 270, 11) + star(360, 60, 14);
}
const star = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * .3} ${y - r * .3} L${x + r} ${y} L${x + r * .3} ${y + r * .3} L${x} ${y + r} L${x - r * .3} ${y + r * .3} L${x - r} ${y} L${x - r * .3} ${y - r * .3} Z" fill="${C.ink}"/>`;

function bag() {
  return L(`<path d="M150 150 V110 Q150 60 200 60 Q250 60 250 110 V150"/>`, 16) +
    U(`<path d="M80 140 H320 L344 370 H56 Z" fill="${C.tag}"/>`) +
    `<circle cx="150" cy="160" r="9" fill="${C.ink}"/><circle cx="250" cy="160" r="9" fill="${C.ink}"/>` +
    `<text x="200" y="290" text-anchor="middle" font-family="IBM Plex Sans Arabic, Tahoma, sans-serif" font-weight="700" font-size="86" fill="#fff" direction="rtl">عشرة</text>` +
    star(46, 70, 22) + star(360, 110, 16) + star(350, 30, 10);
}
function truck() {
  return U(`<rect x="20" y="110" width="250" height="180" rx="14" fill="${C.tag}"/><path d="M270 160 H330 L380 220 V290 H270 Z" fill="${C.w}"/><circle cx="90" cy="300" r="40" fill="${C.ink}"/><circle cx="320" cy="300" r="40" fill="${C.ink}"/>`) +
    `<path d="M290 178 H322 L356 220 H290 Z" fill="${C.t2}"/><circle cx="90" cy="300" r="14" fill="${C.w}"/><circle cx="320" cy="300" r="14" fill="${C.w}"/>` +
    `<text x="145" y="245" text-anchor="middle" font-family="Archivo Black, Arial Black, sans-serif" font-size="120" fill="#fff">5</text>` +
    L(`<path d="M-10 160 h-0M0 360 h120M160 360 h220"/>`, 8);
}
function box(x, y, s, fill = C.t4) {
  return place(U(`<rect x="0" y="40" width="200" height="150" rx="10" fill="${fill}"/><path d="M-12 40 L20 0 H180 L212 40 Z" fill="${C.w}"/>`, 14) + `<rect x="80" y="40" width="40" height="70" fill="${C.tag}"/>` + L(`<path d="M80 40 L90 0M120 40 L110 0"/>`, 6), x, y, s);
}
function cash() {
  const note = (x, y, r) => `<g transform="rotate(${r} ${x + 110} ${y + 55})">` + U(`<rect x="${x}" y="${y}" width="220" height="110" rx="12" fill="${C.t3}"/>`, 12) +
    `<circle cx="${x + 110}" cy="${y + 55}" r="28" fill="none" stroke="${C.ink}" stroke-width="6"/>` + L(`<path d="M${x + 22} ${y + 22}h30M${x + 168} ${y + 88}h30"/>`, 6) + `</g>`;
  return box(30, 60, 1.05) + note(150, 230, -10) + note(170, 260, 6) +
    `<text x="281" y="355" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="34" fill="${C.ink}">DT</text>`;
}
function grid6() {
  const items = [sock, phoneGlass, beanie, spray];
  return items.map((f, i) => { const x = (i % 2) * 205, y = Math.floor(i / 2) * 205;
    return place(f(), x, y, 0.48); }).join("");
}

module.exports = { C, svg, sock, glove, sponges, sinkNet, airfryer, hijabPins, phoneGlass, carBag, catGlove, cloths, beanie, hijabPack, pot, spray, study, ramadan, bag, truck, cash, grid6, box };
