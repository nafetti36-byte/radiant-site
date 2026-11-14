/** D1-compatible facade over an in-memory SQLite database (sql.js), so the Worker code
 *  runs unchanged on Netlify Functions. Persistence is handled by ./store.ts. */
import type { Database, SqlValue } from 'sql.js';

const norm = (v: unknown): SqlValue => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string' || v instanceof Uint8Array) return v as SqlValue;
  if (typeof v === 'bigint') return Number(v);
  return String(v);
};

function query(db: Database, sql: string, params: SqlValue[]): Record<string, unknown>[] {
  const st = db.prepare(sql);
  try {
    st.bind(params);
    const rows: Record<string, unknown>[] = [];
    while (st.step()) rows.push(st.getAsObject() as Record<string, unknown>);
    return rows;
  } finally { st.free(); }
}

export class Stmt {
  constructor(private db: Database, readonly sql: string, private params: SqlValue[] = []) {}
  bind(...p: unknown[]) { return new Stmt(this.db, this.sql, p.map(norm)); }
  async first<T = Record<string, unknown>>(col?: string): Promise<T | null> {
    const r = query(this.db, this.sql, this.params)[0];
    if (!r) return null;
    return (col ? r[col] : r) as T;
  }
  async all<T = Record<string, unknown>>() {
    return { results: query(this.db, this.sql, this.params) as T[], success: true, meta: {} };
  }
  runSync() {
    if (/^\s*(select|pragma|with)\b/i.test(this.sql)) return { results: query(this.db, this.sql, this.params), success: true, meta: { changes: 0, last_row_id: 0 } };
    this.db.run(this.sql, this.params);
    const changes = this.db.getRowsModified();
    const last = query(this.db, 'SELECT last_insert_rowid() AS id', [])[0].id as number;
    return { results: [], success: true, meta: { changes, last_row_id: last } };
  }
  async run() { return this.runSync(); }
  async raw() { return query(this.db, this.sql, this.params).map((r) => Object.values(r)); }
}

export class D1Facade {
  constructor(readonly db: Database) {}
  prepare(sql: string) { return new Stmt(this.db, sql); }
  async batch(stmts: Stmt[]) {
    this.db.run('BEGIN');
    try {
      const out = stmts.map((s) => s.runSync());
      this.db.run('COMMIT');
      return out;
    } catch (e) { this.db.run('ROLLBACK'); throw e; }
  }
  async exec(sql: string) { this.db.exec(sql); return { count: 1, duration: 0 }; }
  totalChanges(): number { return query(this.db, 'SELECT total_changes() AS n', [])[0].n as number; }
}
