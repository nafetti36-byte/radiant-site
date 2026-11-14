export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

const SEC_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Cache-Control': 'no-store',
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SEC_HEADERS, ...headers },
  });
}

export function file(body: BodyInit, contentType: string, filename: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename.replace(/[^\w.\-]/g, '_')}"`,
      ...SEC_HEADERS,
    },
  });
}

export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 1_000_000): Promise<T> {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'Requête trop volumineuse');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Requête trop volumineuse');
  if (!text) return {} as T;
  try {
    const v = JSON.parse(text);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v as T;
  } catch {
    throw new HttpError(400, 'JSON invalide');
  }
}

// ───── Declarative validation ─────
export type FieldSpec =
  | { type: 'string'; required?: boolean; max?: number; enum?: readonly string[]; pattern?: RegExp }
  | { type: 'number'; required?: boolean; min?: number; max?: number; integer?: boolean }
  | { type: 'date'; required?: boolean }
  | { type: 'bool'; required?: boolean };

export type Schema = Record<string, FieldSpec>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates & coerces `input` against `schema`. Unknown keys are dropped. */
export function validate(
  schema: Schema,
  input: Record<string, unknown>,
  opts: { partial?: boolean } = {},
): { value: Record<string, string | number | null>; errors: Record<string, string> } {
  const value: Record<string, string | number | null> = {};
  const errors: Record<string, string> = {};
  for (const [key, spec] of Object.entries(schema)) {
    let raw = input[key];
    if (typeof raw === 'string') raw = raw.trim();
    const missing = raw === undefined || raw === null || raw === '';
    if (missing) {
      if (opts.partial && raw === undefined) continue;
      if (spec.required) errors[key] = 'obligatoire';
      else value[key] = null;
      continue;
    }
    switch (spec.type) {
      case 'string': {
        const s = String(raw);
        if (spec.max && s.length > spec.max) errors[key] = `max ${spec.max} caractères`;
        else if (spec.enum && !spec.enum.includes(s)) errors[key] = `valeur non autorisée`;
        else if (spec.pattern && !spec.pattern.test(s)) errors[key] = 'format invalide';
        else value[key] = s;
        break;
      }
      case 'number': {
        const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/\s/g, '').replace(',', '.'));
        if (!Number.isFinite(n)) errors[key] = 'nombre invalide';
        else if (spec.integer && !Number.isInteger(n)) errors[key] = 'entier attendu';
        else if (spec.min !== undefined && n < spec.min) errors[key] = `min ${spec.min}`;
        else if (spec.max !== undefined && n > spec.max) errors[key] = `max ${spec.max}`;
        else value[key] = n;
        break;
      }
      case 'date': {
        const s = normaliseDate(String(raw));
        if (!s) errors[key] = 'date invalide (AAAA-MM-JJ)';
        else value[key] = s;
        break;
      }
      case 'bool': {
        const s = String(raw).toLowerCase();
        value[key] = ['1', 'true', 'oui', 'yes', 'on'].includes(s) ? 1 : 0;
        break;
      }
    }
  }
  return { value, errors };
}

export function normaliseDate(s: string): string | null {
  s = s.trim();
  if (DATE_RE.test(s)) return isValidDate(s) ? s : null;
  // dd/mm/yyyy (French) or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return isValidDate(iso) ? iso : null;
  }
  // Excel serial date
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  // ISO datetime
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return null;
}

function isValidDate(iso: string): boolean {
  const d = new Date(iso + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export function assertValid(errors: Record<string, string>) {
  if (Object.keys(errors).length) throw new HttpError(422, 'Données invalides', errors);
}

export function round(n: number | null | undefined, d = 2): number | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a.slice(0, 10) + 'T00:00:00Z').getTime()) / 86400000);
}
