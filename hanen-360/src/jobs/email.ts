import type { Env } from '../env';
import { getSettings } from '../lib/settings';
import { setConnector } from './connectors';
import { audit } from '../lib/audit';
import { aiConfigured } from '../ai/client';
import { extractQuote } from '../ai/extract';
import { runJob } from './runner';

/** Very small MIME reader: returns the first text/plain part (decoding QP / base64). */
export function extractPlainText(raw: string): string {
  const decodeQP = (s: string) => s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const decodePart = (headers: string, body: string) => {
    if (/content-transfer-encoding:\s*base64/i.test(headers)) { try { return new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\s/g, '')), (c) => c.charCodeAt(0))); } catch { return body; } }
    if (/content-transfer-encoding:\s*quoted-printable/i.test(headers)) return new TextDecoder().decode(Uint8Array.from(decodeQP(body), (c) => c.charCodeAt(0) & 255));
    return body;
  };
  const split = (s: string) => { const i = s.search(/\r?\n\r?\n/); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i).replace(/^\r?\n\r?\n/, '')]; };
  const [head, body] = split(raw);
  const boundary = head.match(/boundary="?([^";\r\n]+)"?/i)?.[1];
  if (!boundary) return decodePart(head, body);
  for (const part of body.split('--' + boundary)) {
    const [h, b] = split(part.replace(/^\r?\n/, ''));
    if (/content-type:\s*multipart\//i.test(h)) { const inner = extractPlainText(part.replace(/^\r?\n/, '')); if (inner) return inner; }
    if (/content-type:\s*text\/plain/i.test(h)) return decodePart(h, b);
  }
  for (const part of body.split('--' + boundary)) {
    const [h, b] = split(part.replace(/^\r?\n/, ''));
    if (/content-type:\s*text\/html/i.test(h)) return decodePart(h, b).replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  }
  return '';
}

/** Cloudflare Email Routing → Worker. Only allow-listed supplier domains are accepted;
 *  quotations are stored as drafts pending human validation. */
export async function handleEmail(message: ForwardableEmailMessage, env: Env) {
  const s = await getSettings(env);
  const allowed = s.email_allowed_domains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  const from = message.from.toLowerCase();
  const domain = from.split('@')[1] || '';
  if (!allowed.length || !allowed.some((d) => domain === d || domain.endsWith('.' + d))) {
    await audit(env, { actor: `email:${from}` }, 'email.rejected_sender');
    message.setReject('Sender not authorised');
    return;
  }
  if (message.rawSize > 5_000_000) { message.setReject('Message too large'); return; }
  const raw = await new Response(message.raw).text();
  const subject = message.headers.get('subject') || '';
  const text = extractPlainText(raw).slice(0, 200_000);
  const ins = await env.DB.prepare("INSERT INTO h360_inbound_docs (channel, sender, subject, body_text, status) VALUES ('email', ?, ?, ?, 'pending')").bind(from, subject.slice(0, 300), text).run();
  const id = Number(ins.meta.last_row_id);
  await setConnector(env, 'email', 'connected', `Dernier email autorisé reçu de ${domain}`, true);
  await audit(env, { actor: `email:${from}` }, 'email.received', 'inbound_docs', id);
  if (aiConfigured(env) && text) {
    const r = await runJob(env, 'email_extraction', 'data_integration', `email:${from}`, { doc_id: id }, () => extractQuote(env, { text: `${subject}\n${text}` }));
    if (r.ok) await env.DB.prepare("UPDATE h360_inbound_docs SET extracted_json=?, status='extracted' WHERE id=?").bind(JSON.stringify(r.output), id).run();
  }
}
