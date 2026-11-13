// Prints a JSON array of inline SVG illustrations, one per product in products.json (same order).
// Reuses the post illustrations from art.js and adds a few shop-only drawings.
const A = require("./art.js");
const { C, svg } = A;
const U = (s, sw = 16) => `<g stroke="${C.ink}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${s}</g><g stroke="none">${s}</g>`;
const L = (s, sw = 8, col = C.ink) => `<g fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${s}</g>`;
const place = (inner, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;

// foam roll / lint roller
const roll = () => U(`<rect x="60" y="150" width="200" height="120" rx="20" fill="${C.t4}"/><ellipse cx="260" cy="210" rx="40" ry="60" fill="${C.w}"/><ellipse cx="260" cy="210" rx="16" ry="24" fill="${C.tag}"/>`) +
  L(`<path d="M90 170v80M130 170v80M170 170v80M210 170v80"/>`, 5, "#00000022");
// zip freezer bag
const zipbag = () => U(`<rect x="90" y="90" width="220" height="250" rx="16" fill="${C.t2}"/><rect x="90" y="90" width="220" height="40" rx="12" fill="${C.tag}"/>`) +
  L(`<path d="M120 190h160M120 230h120M120 270h140"/>`, 8, C.w);
// hoop earrings
const earrings = () => L(`<circle cx="140" cy="230" r="80"/><circle cx="270" cy="230" r="80"/>`, 30, C.ink) +
  L(`<circle cx="140" cy="230" r="80"/><circle cx="270" cy="230" r="80"/>`, 18, "#e8a51f") + L(`<path d="M140 120v30M270 120v30"/>`, 10);
// balloons
const balloons = () => [[130, 160, C.tag], [210, 130, C.t2], [280, 180, "#e8a51f"]].map(([x, y, c]) =>
  L(`<path d="M${x} ${y + 70} Q${x + 15} ${y + 140} ${x - 5} ${y + 220}"/>`, 5) + U(`<ellipse cx="${x}" cy="${y}" rx="55" ry="70" fill="${c}"/>`)).join("");
// pens (stationery)
const pens = () => [C.tag, C.t2, "#e8a51f", C.t3, C.ink].map((c, i) =>
  U(`<g transform="rotate(${-18 + i * 9} 200 220)"><rect x="${110 + i * 40}" y="90" width="26" height="230" rx="10" fill="${c}"/><path d="M${110 + i * 40} 320 l13 34 l13 -34 Z" fill="${C.w}"/></g>`, 12)).join("");

const MAP = {
  1: A.sock, 2: A.beanie, 3: () => A.glove(false), 4: roll, 5: A.sock,
  6: A.sponges, 7: A.sponges, 8: zipbag, 9: A.airfryer, 10: A.airfryer,
  11: A.cloths, 12: roll, 13: A.sponges, 14: A.sinkNet, 15: A.cloths,
  16: A.hijabPack, 17: A.hijabPins, 18: A.hijabPack, 19: A.hijabPack, 20: A.hijabPack,
  21: A.phoneGlass, 22: A.phoneGlass, 23: A.phoneGlass, 24: A.phoneGlass,
  25: pens, 26: pens, 27: A.study, 28: pens, 29: A.study,
  30: A.carBag, 31: A.cloths, 32: A.cloths,
  33: A.ramadan, 34: A.ramadan, 35: A.bag, 36: () => A.box(110, 110, 1),
  37: A.catGlove, 38: A.catGlove, 39: A.catGlove,
  40: earrings, 41: earrings, 42: earrings, 43: balloons, 44: A.bag,
};
const products = require("../../products.json");
const out = products.map((p, i) => {
  const f = MAP[i + 1];
  if (!f) return null;
  // strip ×N badges (circle + text) — the lot size is already in the product name
  const inner = f().replace(/<circle cx="\d+" cy="\d+" r="5\d" fill="#17181c"\/><text[^>]*>[^<]*<\/text>/g, "");
  return svg(inner);
});
process.stdout.write(JSON.stringify(out));
