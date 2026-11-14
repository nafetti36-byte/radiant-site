import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../env';

export function aiConfigured(env: Env) { return !!env.ANTHROPIC_API_KEY; }

export function aiClient(env: Env) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('Connexion requise : secret ANTHROPIC_API_KEY non configuré');
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined, maxRetries: 2, timeout: 120_000 });
}

export const model = (env: Env) => env.AI_MODEL || 'claude-opus-5-5';

/** Messages call with server-side refusal fallback enabled. If the account/API rejects the
 *  fallback parameter, retries once without it. */
export async function createMessage(env: Env, params: Record<string, unknown>): Promise<Anthropic.Beta.BetaMessage> {
  const client = aiClient(env);
  try {
    return await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any) as Anthropic.Beta.BetaMessage;
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) {
      return await client.beta.messages.create(params as any) as Anthropic.Beta.BetaMessage;
    }
    throw e;
  }
}

export function aiErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'Clé API Anthropic invalide — vérifier le secret ANTHROPIC_API_KEY';
  if (e instanceof Anthropic.RateLimitError) return 'Limite de débit du service IA atteinte — réessayer dans une minute';
  if (e instanceof Anthropic.APIConnectionError) return 'Service IA injoignable';
  if (e instanceof Anthropic.APIError) return `Erreur du service IA (${e.status ?? 'n.d.'})`;
  return String((e as any)?.message ?? e);
}
