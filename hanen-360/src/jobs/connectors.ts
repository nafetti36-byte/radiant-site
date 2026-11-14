import type { Env } from '../env';
import { getSettings } from '../lib/settings';
import { today } from '../lib/http';

export async function setConnector(env: Env, id: string, status: 'connected' | 'error' | 'not_configured' | 'disabled', detail: string, ok: boolean) {
  await env.DB.prepare(
    `UPDATE h360_connectors SET status=?, detail=?, last_check_at=datetime('now') ${ok ? ", last_ok_at=datetime('now')" : ''} WHERE id=?`,
  ).bind(status, detail.slice(0, 500), id).run();
}

export async function connectorEnabled(env: Env, id: string) {
  const r = await env.DB.prepare('SELECT enabled FROM h360_connectors WHERE id=?').bind(id).first<{ enabled: number }>();
  return !!r?.enabled;
}

/** Exchange rates. Default provider: open.er-api.com (free, no key). The admin must enable
 *  it explicitly; rates are stored with source and timestamp. For regulatory accounting the
 *  Banque Centrale de Tunisie fixing should be entered/imported as the reference. */
export async function updateFx(env: Env, createdBy: string) {
  const s = await getSettings(env);
  const curs = s.fx_currencies.split(',').map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c) && c !== 'TND');
  const tpl = env.FX_API_BASE ? `${env.FX_API_BASE}/{CUR}` : s.fx_provider_url;
  const saved: any[] = [];
  for (const cur of curs) {
    const url = tpl.replace('{CUR}', cur);
    let resp: Response;
    try { resp = await fetch(url, { headers: { Accept: 'application/json' } }); }
    catch (e: any) { await setConnector(env, 'fx', 'error', `Réseau: ${e.message}`, false); throw new Error(`FX ${cur}: ${e.message}`); }
    if (!resp.ok) { await setConnector(env, 'fx', 'error', `HTTP ${resp.status} sur ${new URL(url).host}`, false); throw new Error(`FX ${cur}: HTTP ${resp.status}`); }
    const j: any = await resp.json();
    const rate = j?.rates?.TND ?? j?.conversion_rates?.TND;
    if (!(typeof rate === 'number' && rate > 0)) { await setConnector(env, 'fx', 'error', 'Réponse sans taux TND', false); throw new Error(`FX ${cur}: taux TND absent`); }
    const date = (j.time_last_update_utc ? new Date(j.time_last_update_utc).toISOString().slice(0, 10) : null) || j.date || today();
    await env.DB.prepare("INSERT INTO h360_fx_rates (currency, rate_tnd, rate_date, source, source_type) VALUES (?,?,?,?, 'feed')")
      .bind(cur, rate, date, new URL(url).host).run();
    saved.push({ currency: cur, rate_tnd: rate, date, source: new URL(url).host });
  }
  await setConnector(env, 'fx', 'connected', `Dernière mise à jour: ${saved.map((x) => `${x.currency}=${x.rate_tnd}`).join(', ')}`, true);
  return { saved, by: createdBy };
}

/** Licensed pulp price feed. Expected JSON: { prices: [{ grade, date, price, currency, basis?, source? }] } */
export async function syncPulpFeed(env: Env) {
  if (!env.PULP_FEED_URL) { await setConnector(env, 'pulp_feed', 'not_configured', 'Connexion requise : secret PULP_FEED_URL (flux sous licence) non configuré', false); throw new Error('Connexion requise'); }
  const resp = await fetch(env.PULP_FEED_URL, { headers: env.PULP_FEED_TOKEN ? { Authorization: `Bearer ${env.PULP_FEED_TOKEN}` } : {} });
  if (!resp.ok) { await setConnector(env, 'pulp_feed', 'error', `HTTP ${resp.status}`, false); throw new Error(`Flux pâte: HTTP ${resp.status}`); }
  const j: any = await resp.json();
  if (!Array.isArray(j?.prices)) { await setConnector(env, 'pulp_feed', 'error', 'Format inattendu (prices[] absent)', false); throw new Error('Format de flux inattendu'); }
  let n = 0;
  for (const p of j.prices) {
    if (!p?.grade || !p?.date || !(Number(p.price) > 0) || !/^[A-Z]{3}$/.test(p.currency || '')) continue;
    const dup = await env.DB.prepare("SELECT id FROM h360_market_prices WHERE grade=? AND price_date=? AND source_type='feed'").bind(p.grade, p.date).first();
    if (dup) continue;
    await env.DB.prepare("INSERT INTO h360_market_prices (grade, price_date, price, currency, basis, source, source_type, validation_status) VALUES (?,?,?,?,?,?, 'feed', 'validated')")
      .bind(String(p.grade).toUpperCase(), p.date, Number(p.price), p.currency, p.basis ?? null, p.source ?? new URL(env.PULP_FEED_URL).host).run();
    n++;
  }
  await setConnector(env, 'pulp_feed', 'connected', `${n} nouveau(x) prix importé(s)`, true);
  return { imported: n };
}

/** Sends a message only through an explicitly configured, enabled webhook. */
export async function notify(env: Env, text: string): Promise<{ sent: boolean; reason?: string }> {
  if (!env.NOTIFY_WEBHOOK_URL) return { sent: false, reason: 'Connexion requise (NOTIFY_WEBHOOK_URL)' };
  if (!(await connectorEnabled(env, 'notify'))) return { sent: false, reason: 'Canal désactivé par l’administrateur' };
  const r = await fetch(env.NOTIFY_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  await setConnector(env, 'notify', r.ok ? 'connected' : 'error', r.ok ? 'Dernier envoi réussi' : `HTTP ${r.status}`, r.ok);
  return { sent: r.ok, reason: r.ok ? undefined : `HTTP ${r.status}` };
}
