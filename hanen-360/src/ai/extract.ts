import type { Env } from '../env';
import { createMessage, model } from './client';
import { b64 } from '../lib/crypto';

/** Extracts a supplier quotation into a draft. The draft is ALWAYS pending human validation. */
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    is_quotation: { type: 'boolean' },
    supplier_name: { type: ['string', 'null'] },
    offers: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      category: { type: 'string', enum: ['virgin_pulp', 'recovered'] },
      grade: { type: 'string', description: 'NBSK, BEKP, BHKP, SWL, HWS, SOP or the exact grade written' },
      price: { type: 'number' }, currency: { type: 'string' }, incoterm: { type: ['string', 'null'] },
      quantity_t: { type: ['number', 'null'] }, offer_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' }, valid_until: { type: ['string', 'null'] },
      payment_terms_days: { type: ['number', 'null'] }, moisture_pct: { type: ['number', 'null'] }, contamination_pct: { type: ['number', 'null'] },
      source_quote: { type: 'string', description: 'Verbatim excerpt from the document supporting the price' },
    }, required: ['category', 'grade', 'price', 'currency', 'incoterm', 'quantity_t', 'offer_date', 'valid_until', 'payment_terms_days', 'moisture_pct', 'contamination_pct', 'source_quote'] } },
    notes: { type: 'string' },
  },
  required: ['is_quotation', 'supplier_name', 'offers', 'notes'],
};

const INSTRUCTIONS = 'Extract the supplier price quotation(s) for pulp or recovered paper from this document. Only report values literally present in the document; use null when absent. Do not guess prices. Grades: virgin pulp (NBSK, BEKP, BHKP...) or recovered paper (SWL = sorted white ledger, HWS = heavy white shavings, SOP = sorted office paper).';

export async function extractQuote(env: Env, doc: { pdf?: ArrayBuffer; text?: string }) {
  const content: any[] = [];
  if (doc.pdf) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64(doc.pdf) } });
  else content.push({ type: 'text', text: `<document>\n${(doc.text || '').slice(0, 100_000)}\n</document>` });
  content.push({ type: 'text', text: INSTRUCTIONS });
  const resp = await createMessage(env, {
    model: model(env), max_tokens: 8000, messages: [{ role: 'user', content }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
  });
  if (resp.stop_reason === 'refusal') throw new Error('Extraction refusée par le service IA');
  const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  try { return JSON.parse(text); } catch { throw new Error('Réponse d’extraction illisible'); }
}
