// Local stand-ins for external services used ONLY by the automated test-suite:
//  - Anthropic Messages API (deterministic tool-use behaviour)
//  - FX provider (open.er-api.com response shape)
// Production never uses these; the Worker only talks to them when ANTHROPIC_BASE_URL /
// FX_API_BASE are overridden in the test run.
import http from 'node:http';

export const anthropicLog = [];

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function startAnthropicMock(port) {
  const srv = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (req.method === 'GET' && req.url.startsWith('/v1/models/') && /bad/.test(req.headers.authorization || req.headers['x-api-key'] || '')) return send(res, 401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
      if (req.method === 'GET' && req.url.startsWith('/v1/models/')) return send(res, 200, { id: decodeURIComponent(req.url.split('/').pop()), type: 'model', display_name: 'mock' });
      if (req.method !== 'POST' || !req.url.startsWith('/v1/messages')) return send(res, 404, { error: 'nf' });
      if (!req.headers['x-api-key'] && !req.headers.authorization) return send(res, 401, { type: 'error', error: { type: 'authentication_error', message: 'no key' } });
      const body = JSON.parse(raw);
      anthropicLog.push({ headers: req.headers, body });
      const last = body.messages[body.messages.length - 1];
      const id = `msg_${anthropicLog.length}`;
      const base = { id, type: 'message', role: 'assistant', model: body.model, usage: { input_tokens: 10, output_tokens: 10 } };
      // Structured extraction (PDF/email)
      if (body.output_config?.format?.type === 'json_schema') {
        return send(res, 200, { ...base, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ is_quotation: true, supplier_name: 'Recyclage Cap Bon', offers: [{ category: 'recovered', grade: 'SOP', price: 1010, currency: 'TND', incoterm: 'DAP Usine', quantity_t: 300, offer_date: '2026-11-10', valid_until: '2026-12-10', payment_terms_days: 45, moisture_pct: 9, contamination_pct: 2, source_quote: 'SOP : 1 010 TND/t rendu usine' }], notes: '' }) }] });
      }
      const toolNames = (body.tools || []).map((t) => t.name);
      const lastIsToolResult = Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_result');
      if (!lastIsToolResult && toolNames.includes('get_fibre_analysis')) {
        return send(res, 200, { ...base, stop_reason: 'tool_use', content: [
          { type: 'thinking', thinking: '', signature: 'sig' },
          { type: 'text', text: 'Je consulte les offres.' },
          { type: 'tool_use', id: `tu_${anthropicLog.length}_a`, name: 'get_fibre_analysis', input: { grade: 'SWL' } },
          { type: 'tool_use', id: `tu_${anthropicLog.length}_b`, name: 'get_fx_rates', input: {} },
        ] });
      }
      if (lastIsToolResult && toolNames.includes('propose_recommendation') && !body.messages.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_use' && b.name === 'propose_recommendation'))) {
        const fibre = JSON.parse(last.content.find((b) => b.type === 'tool_result' && b.content?.includes?.('offers'))?.content || '{"offers":[]}');
        const o = (fibre.offers || []).find((x) => x.negotiation) || {};
        return send(res, 200, { ...base, stop_reason: 'tool_use', content: [{ type: 'tool_use', id: `tu_${anthropicLog.length}_p`, name: 'propose_recommendation', input: {
          module: 'recovered', title: `Plafond SWL ${o.ceiling?.max_price ?? 'n.d.'} TND/t`, summary: 'Ne pas payer au-delà du plafond calculé.', reasoning: o.ceiling?.formula || 'n.d.',
          input_record_ids: [`offer:${o.offer_id}`], savings_tnd: o.negotiation?.savings_tnd ?? 0, risks: 'Validation qualité requise', data_freshness: o.offer_date || 'n.d.', confidence: 0.8, missing_info: 'aucune' } }] });
      }
      const fibre = body.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((b) => b.type === 'tool_result').map((b) => b.content).find((c) => typeof c === 'string' && c.includes('"offers"'));
      const parsed = fibre ? JSON.parse(fibre) : null;
      const swl = parsed?.offers?.filter((x) => x.grade === 'SWL' && x.ceiling) || [];
      const text = swl.length ? `**Prix maximum SWL** : ${swl.map((x) => `${x.supplier} → ${x.ceiling.max_price} ${x.currency}/t (cible ${x.negotiation.target_price})`).join(' ; ')}.\n- Formule : ${swl[0].ceiling.formula}` : 'Données insuffisantes.';
      return send(res, 200, { ...base, stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '', signature: 'sig2' }, { type: 'text', text }] });
    });
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)));
}

export function startFxMock(port) {
  const rates = { EUR: 3.385, USD: 3.112 };
  const srv = http.createServer((req, res) => {
    const cur = req.url.replace('/', '').toUpperCase();
    if (!rates[cur]) return send(res, 404, { result: 'error' });
    send(res, 200, { result: 'success', base_code: cur, time_last_update_utc: new Date().toUTCString(), rates: { TND: rates[cur], [cur]: 1 } });
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)));
}
