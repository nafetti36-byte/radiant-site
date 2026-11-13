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

// ---------- one drawing per product ----------
const G = "#e8a51f";
const fluffySock = () => U(`<path d="M150 60 h110 v170 q0 40 -40 70 l-60 45 q-40 25 -70 -10 q-25 -35 15 -65 l45 -35 Z" fill="${C.t1}"/>`, 16) +
  [[180,110],[220,140],[175,170],[225,200],[190,230],[150,270],[110,300]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="9" fill="${C.w}"/>`).join("") +
  U(`<rect x="140" y="52" width="130" height="34" rx="12" fill="${C.w}"/>`, 12);
const steelPads = () => [[130,230],[260,230],[195,140]].map(([x,y])=>U(`<circle cx="${x}" cy="${y}" r="70" fill="#d9dbe0"/>`,14) +
  L(`<path d="M${x-45} ${y} q45 -60 90 0 q-45 55 -80 5 q35 -35 60 -2"/>`, 6, "#8a8e99")).join("");
const cupcake = () => U(`<path d="M110 220 h180 l-25 130 h-130 Z" fill="${C.t2}"/>`) + L(`<path d="M140 225 l12 120M175 225 l6 120M210 225 v120M245 225 l-6 120M275 225 l-12 120"/>`, 6, "#9ec3e3") +
  U(`<path d="M105 225 q-10 -60 55 -70 q20 -60 80 -40 q60 0 55 60 q30 20 5 50 Z" fill="${C.w}"/>`) + `<circle cx="225" cy="105" r="18" fill="${C.tag}" stroke="${C.ink}" stroke-width="10"/>`;
const lintRoller = () => U(`<rect x="90" y="90" width="230" height="110" rx="24" fill="${C.w}"/><rect x="190" y="200" width="30" height="160" rx="12" fill="${C.tag}"/>`) +
  L(`<path d="M120 120h170M120 150h170M120 175h170"/>`, 5, "#00000022");
const magicSponges = () => [[80,250,0],[150,170,-6],[210,250,4]].map(([x,y,r])=>U(`<rect x="${x}" y="${y}" width="120" height="80" rx="10" fill="${C.w}" transform="rotate(${r} ${x+60} ${y+40})"/>`,14)).join("") +
  L(`<path d="M300 90l14 -30l14 30l30 14l-30 14l-14 30l-14 -30l-30 -14Z"/>`, 6, C.tag);
const towel = () => L(`<path d="M120 80 h160"/>`, 14) + U(`<path d="M140 80 h120 v250 q-60 25 -120 0 Z" fill="${C.tag}"/>`) + L(`<path d="M140 280 q60 25 120 0M140 300 q60 25 120 0"/>`, 6, C.w);
const clawClip = () => U(`<path d="M90 230 q110 -150 220 0 l-30 20 q-80 -90 -160 0 Z" fill="${C.tag}"/>`) + L(`<path d="M120 245 l-15 70M160 230 l-10 85M200 225v90M240 230l10 85M280 245l15 70"/>`, 16) + L(`<path d="M120 245 l-15 70M160 230 l-10 85M200 225v90M240 230l10 85M280 245l15 70"/>`, 8, C.tag);
const scrunchies = () => [[140,180,C.tag],[260,180,C.t2],[200,280,G]].map(([x,y,c])=>`<circle cx="${x}" cy="${y}" r="56" fill="none" stroke="${C.ink}" stroke-width="54"/><circle cx="${x}" cy="${y}" r="56" fill="none" stroke="${c}" stroke-width="40"/>`).join("");
const hairTies = () => [[120,150],[200,130],[280,160],[150,240],[240,240],[200,320],[110,320],[300,300]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="38" fill="none" stroke="${C.ink}" stroke-width="16"/><circle cx="${x}" cy="${y}" r="38" fill="none" stroke="${[C.tag,G,C.ink,"#9ec3e3"][i%4]}" stroke-width="8"/>`).join("");
const phoneCase = () => U(`<rect x="120" y="50" width="170" height="310" rx="36" fill="${C.t2}"/><rect x="138" y="68" width="134" height="274" rx="24" fill="${C.w}"/><rect x="145" y="80" width="56" height="70" rx="16" fill="${C.ink}"/>`) +
  `<circle cx="160" cy="100" r="9" fill="${C.mid}"/><circle cx="186" cy="100" r="9" fill="${C.mid}"/><circle cx="160" cy="130" r="9" fill="${C.mid}"/>`;
const cable = () => L(`<path d="M60 330 q80 -10 120 -90 q40 -80 120 -90"/>`, 22) + L(`<path d="M60 330 q80 -10 120 -90 q40 -80 120 -90"/>`, 12, C.w) +
  U(`<rect x="290" y="120" width="70" height="56" rx="10" fill="${C.w}"/><rect x="355" y="136" width="20" height="24" rx="4" fill="#d9dbe0"/>`) +
  L(`<path d="M255 140 l10 30M268 135 l10 30M281 132 l10 30"/>`, 10, C.tag);
const lanyard = () => U(`<rect x="230" y="60" width="120" height="230" rx="28" fill="${C.w}"/>`) + L(`<path d="M250 270 q-120 40 -150 -60 q-30 -110 60 -150"/>`, 26) + L(`<path d="M250 270 q-120 40 -150 -60 q-30 -110 60 -150"/>`, 16, C.tag);
const highlighters = () => ["#ffd2dc","#c8ecd6","#cfe3f7","#ffe7b0","#e5d6f5","#ffd9c2"].map((c,i)=>U(`<g transform="rotate(${-20+i*8} 200 220)"><rect x="${70+i*45}" y="110" width="40" height="200" rx="12" fill="${c}"/><rect x="${70+i*45}" y="110" width="40" height="50" rx="12" fill="${C.w}"/></g>`,12)).join("");
const erasable = () => U(`<rect x="90" y="80" width="40" height="260" rx="14" fill="${C.t2}"/><rect x="90" y="80" width="40" height="40" rx="12" fill="${C.tag}"/>`,12) +
  [0,1,2,3].map(i=>U(`<rect x="${180+i*40}" y="120" width="16" height="200" rx="7" fill="${C.w}"/>`,10)).join("") + L(`<path d="M180 340 h140"/>`,6,C.tag);
const notebook = () => U(`<rect x="110" y="60" width="200" height="280" rx="14" fill="${C.t1}"/><rect x="250" y="60" width="18" height="280" fill="${C.tag}"/>`) +
  U(`<rect x="140" y="110" width="90" height="60" rx="8" fill="${C.w}"/>`,10) + L(`<path d="M150 200h80M150 230h60"/>`,6,"#00000033");
const windshieldCloth = () => U(`<path d="M60 280 q140 -200 280 0 Z" fill="#cfe3f7"/>`) + L(`<path d="M130 250 q70 -60 140 0"/>`,8,C.w) + U(`<rect x="220" y="220" width="120" height="90" rx="12" fill="${C.tag}" transform="rotate(-12 280 265)"/>`,14);
const carCloths = () => U(`<path d="M70 250 l40 -70 q20 -30 60 -30 h80 q40 0 60 30 l40 70 v60 h-280 Z" fill="${C.t2}"/>`) + `<circle cx="120" cy="315" r="30" fill="${C.ink}"/><circle cx="280" cy="315" r="30" fill="${C.ink}"/>` +
  U(`<rect x="160" y="60" width="90" height="70" rx="10" fill="${C.tag}"/><rect x="180" y="40" width="90" height="70" rx="10" fill="${G}"/>`,12);
const windowStickers = () => U(`<rect x="90" y="60" width="220" height="280" rx="10" fill="#cfe3f7"/>`) + L(`<path d="M200 60v280M90 200h220"/>`,12) +
  `<path d="M150 110 a35 35 0 1 0 30 55 a28 28 0 1 1 -30 -55Z" fill="${G}" stroke="${C.ink}" stroke-width="6"/>` + `<circle cx="255" cy="270" r="22" fill="${G}" stroke="${C.ink}" stroke-width="6"/>`;
const breadBasket = () => U(`<ellipse cx="200" cy="170" rx="120" ry="45" fill="${C.t4}"/><path d="M130 160 q70 -110 140 0 Z" fill="${G}"/><path d="M80 175 q120 60 240 0 l-25 140 h-190 Z" fill="#c98b4b"/>`) +
  L(`<path d="M100 220 h200M110 260 h180M120 295 h160"/>`,6,"#8a5a2b");
const jarLabel = () => U(`<rect x="130" y="70" width="140" height="40" rx="8" fill="${C.tag}"/><rect x="110" y="110" width="180" height="230" rx="30" fill="#e5f0f8"/><rect x="140" y="190" width="120" height="70" rx="10" fill="${C.w}"/>`,14) + L(`<path d="M160 215h80M160 240h50"/>`,6,C.ink);
const featherWand = () => L(`<path d="M70 340 L250 140"/>`,12) + U(`<path d="M250 140 q60 -90 110 -60 q-10 60 -110 60 Z" fill="${C.tag}"/><path d="M250 140 q90 -20 100 30 q-50 30 -100 -30 Z" fill="${G}"/>`,12);
const catToys = () => U(`<ellipse cx="160" cy="250" rx="90" ry="55" fill="#d9dbe0"/><circle cx="235" cy="215" r="22" fill="${C.t1}"/>`) + L(`<path d="M70 260 q-40 20 -20 60"/>`,8) +
  U(`<circle cx="290" cy="140" r="50" fill="${C.tag}"/>`) + L(`<path d="M250 120 q40 30 80 0M250 160 q40 -30 80 0"/>`,6,C.w);
const rings = () => [[140,220,G],[230,200,"#d9dbe0"],[200,290,G]].map(([x,y,c])=>`<circle cx="${x}" cy="${y}" r="55" fill="none" stroke="${C.ink}" stroke-width="30"/><circle cx="${x}" cy="${y}" r="55" fill="none" stroke="${c}" stroke-width="18"/>`).join("") + U(`<circle cx="230" cy="140" r="16" fill="${C.w}"/>`,10);
const bracelet = () => [[200,200,110,G],[200,215,90,"#d9dbe0"]].map(([x,y,r,c])=>`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*0.55}" fill="none" stroke="${C.ink}" stroke-width="20"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r*0.55}" fill="none" stroke="${c}" stroke-width="10" stroke-dasharray="14 6"/>`).join("");
const giftBags = () => [[90,140,C.t4],[200,110,C.tag]].map(([x,y,c])=>U(`<rect x="${x}" y="${y}" width="120" height="${360-y}" rx="8" fill="${c}"/>`) + L(`<path d="M${x+30} ${y} q30 -60 60 0"/>`,10)).join("");

const MAP = {
  1: A.sock, 2: A.beanie, 3: () => A.glove(false), 4: roll, 5: fluffySock,
  6: A.sponges, 7: steelPads, 8: zipbag, 9: A.airfryer, 10: cupcake,
  11: A.cloths, 12: lintRoller, 13: magicSponges, 14: A.sinkNet, 15: towel,
  16: A.hijabPack, 17: A.hijabPins, 18: clawClip, 19: scrunchies, 20: hairTies,
  21: A.phoneGlass, 22: phoneCase, 23: cable, 24: lanyard,
  25: pens, 26: highlighters, 27: A.study, 28: erasable, 29: notebook,
  30: A.carBag, 31: windshieldCloth, 32: carCloths,
  33: A.ramadan, 34: windowStickers, 35: breadBasket, 36: jarLabel,
  37: A.catGlove, 38: featherWand, 39: catToys,
  40: earrings, 41: rings, 42: bracelet, 43: balloons, 44: giftBags,
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
