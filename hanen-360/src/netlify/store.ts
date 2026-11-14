/** Loads/saves the SQLite file in a key-value store (Netlify Blobs in production) with
 *  optimistic concurrency: a write only succeeds if nobody saved in between (etag). */
import initSqlJs from 'sql.js/dist/sql-wasm-inline.js';
import type { Database, SqlJsStatic } from 'sql.js';
import { D1Facade } from './d1';
import { MIGRATIONS } from './migrations.generated';

export interface BlobLike {
  getWithMetadata(key: string, o: { type: 'arrayBuffer' }): Promise<{ data: ArrayBuffer; etag?: string } | null>;
  getMetadata(key: string): Promise<{ etag?: string } | null>;
  set(key: string, data: ArrayBuffer | Uint8Array, o?: { onlyIfMatch?: string; onlyIfNew?: boolean }): Promise<{ modified: boolean; etag?: string }>;
}

const KEY = 'hanen360.sqlite';
let SQL: SqlJsStatic | null = null;
let cached: { db: Database; etag: string | undefined } | null = null;

export class ConflictError extends Error {}

function migrate(db: Database) {
  db.run('CREATE TABLE IF NOT EXISTS h360_d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT DEFAULT (datetime(\'now\')))');
  for (const [name, sql] of MIGRATIONS) {
    const st = db.prepare('SELECT 1 FROM h360_d1_migrations WHERE name = ?');
    st.bind([name]);
    const done = st.step(); st.free();
    if (done) continue;
    db.exec('BEGIN;' + sql + `;INSERT INTO h360_d1_migrations (name) VALUES ('${name.replace(/'/g, "''")}');COMMIT;`);
  }
}

async function load(store: BlobLike): Promise<{ db: Database; etag: string | undefined }> {
  SQL ||= await initSqlJs();
  if (cached) {
    const meta = await store.getMetadata(KEY);
    if (meta?.etag && meta.etag === cached.etag) return cached;
    if (!meta && cached.etag === undefined) return cached;
  }
  const got = await store.getWithMetadata(KEY, { type: 'arrayBuffer' });
  const db = got ? new SQL.Database(new Uint8Array(got.data)) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  migrate(db);
  cached?.db.close();
  cached = { db, etag: got?.etag };
  return cached;
}

/** Runs `fn` against the database; persists if anything changed. Retries on write conflicts. */
export async function withDatabase<T>(store: BlobLike, fn: (d1: D1Facade) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const state = await load(store);
    const d1 = new D1Facade(state.db);
    const before = d1.totalChanges();
    const isNew = state.etag === undefined;
    let result: T;
    try { result = await fn(d1); }
    catch (e) { cached?.db.close(); cached = null; throw e; }
    if (d1.totalChanges() === before && !isNew) return result;
    const bytes = state.db.export();
    const res = await store.set(KEY, bytes, state.etag ? { onlyIfMatch: state.etag } : { onlyIfNew: true });
    if (res.modified) { state.etag = res.etag ?? (await store.getMetadata(KEY))?.etag; return result; }
    cached?.db.close(); cached = null; // someone else wrote: reload and replay
  }
  throw new ConflictError('Base occupée, réessayez');
}
