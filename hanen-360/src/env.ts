export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ENV?: string;
  AI_MODEL?: string;
  SETUP_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  AI_KEY_ENCRYPTION_KEY?: string; // 32 random bytes (base64) to encrypt the AI key pasted in the app
  ANTHROPIC_BASE_URL?: string; // tests only: points to a local mock
  NOTIFY_WEBHOOK_URL?: string;
  PULP_FEED_URL?: string;
  PULP_FEED_TOKEN?: string;
  FX_API_BASE?: string; // tests only
}

export type Role = 'admin' | 'director' | 'analyst' | 'viewer';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  lang: string;
  mfa_enabled: number;
  must_change_password: number;
}

export interface Ctx {
  env: Env;
  req: Request;
  url: URL;
  params: Record<string, string>;
  user: User | null;
  session: { id_hash: string; csrf: string; mfa_pending: number } | null;
  ip: string;
  exec: ExecutionContext;
}
