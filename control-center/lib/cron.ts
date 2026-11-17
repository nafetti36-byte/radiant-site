/** Minimal 5-field cron parser (UTC): minute hour day-of-month month day-of-week.
 * Supports *, numbers, lists (1,3), ranges (1-5) and steps (* /15, 1-10/2). */
type Field = Set<number>;

function parseField(expr: string, min: number, max: number): Field {
  const out = new Set<number>();
  for (const part of expr.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error(`Invalid step in "${expr}"`);
    let lo: number, hi: number;
    if (rangePart === "*") { lo = min; hi = max; }
    else if (rangePart.includes("-")) { [lo, hi] = rangePart.split("-").map(Number); }
    else { lo = Number(rangePart); hi = stepPart ? max : lo; }
    if (![lo, hi].every(Number.isInteger) || lo < min || hi > max || lo > hi) throw new Error(`Invalid cron field "${expr}"`);
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

export function parseCron(expr: string) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error("Cron must have 5 fields");
  const [m, h, dom, mon, dow] = parts;
  const dowSet = parseField(dow, 0, 7);
  if (dowSet.has(7)) dowSet.add(0);
  return {
    minute: parseField(m, 0, 59), hour: parseField(h, 0, 23),
    dom: parseField(dom, 1, 31), month: parseField(mon, 1, 12), dow: dowSet,
    domStar: dom === "*", dowStar: dow === "*",
  };
}

/** Next run strictly after `from`. */
export function nextRun(expr: string, from: Date = new Date()): Date {
  const c = parseCron(expr);
  const d = new Date(from.getTime());
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + 1);
  const limit = from.getTime() + 366 * 24 * 3600 * 1000;
  while (d.getTime() <= limit) {
    if (!c.month.has(d.getUTCMonth() + 1)) { d.setUTCMonth(d.getUTCMonth() + 1, 1); d.setUTCHours(0, 0); continue; }
    const domOk = c.dom.has(d.getUTCDate());
    const dowOk = c.dow.has(d.getUTCDay());
    const dayOk = c.domStar && c.dowStar ? true : c.domStar ? dowOk : c.dowStar ? domOk : domOk || dowOk;
    if (!dayOk) { d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0); continue; }
    if (!c.hour.has(d.getUTCHours())) { d.setUTCHours(d.getUTCHours() + 1, 0); continue; }
    if (!c.minute.has(d.getUTCMinutes())) { d.setUTCMinutes(d.getUTCMinutes() + 1); continue; }
    return d;
  }
  throw new Error("No run within a year");
}
