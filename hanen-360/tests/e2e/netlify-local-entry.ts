// Local harness for the Netlify runtime path: same handler + D1 facade + store logic as
// production, with an in-memory Blobs stand-in that implements etags/conditional writes.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import initSqlJs from 'sql.js/dist/sql-wasm-inline.js';
import { handleRequest, handleCron } from '../../src/netlify/handler';
import type { BlobLike } from '../../src/netlify/store';

let blob: { data: Uint8Array; etag: string } | null = null;
let n = 0;
const store: BlobLike = {
  async getWithMetadata() { return blob ? { data: blob.data.slice().buffer, etag: blob.etag } : null; },
  async getMetadata() { return blob ? { etag: blob.etag } : null; },
  async set(_k, data, o = {}) {
    if (o.onlyIfNew && blob) return { modified: false };
    if (o.onlyIfMatch && (!blob || blob.etag !== o.onlyIfMatch)) return { modified: false };
    blob = { data: new Uint8Array(data instanceof Uint8Array ? data : new Uint8Array(data)).slice(), etag: `"e${++n}"` };
    return { modified: true, etag: blob.etag };
  },
};
const get = (k: string) => process.env[k];
const PUBLIC = 'public';
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const headersFile = readFileSync(join(PUBLIC, '_headers'), 'utf8');
const globalHeaders = Object.fromEntries(headersFile.split('\n/js/*')[0].split('\n').slice(1).map((l) => l.trim()).filter(Boolean).map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));

async function main() {
  if (process.env.SEED_LEGACY) {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(process.env.SEED_LEGACY);
    await store.set('k', db.export(), { onlyIfNew: true });
  }
  http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    try {
      if (url.pathname === '/__scheduled') { await handleCron(url.searchParams.get('cron')!, store, get); res.end('ok'); return; }
      if (url.pathname === '/__test/legacy') {
        const SQL = await initSqlJs(); const db = new SQL.Database(blob!.data);
        const r = db.exec('SELECT * FROM users ORDER BY id'); res.end(JSON.stringify(r)); return;
      }
      if (url.pathname.startsWith('/api/')) {
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
        const r = await handleRequest(new Request(url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), store, get);
        res.writeHead(r.status, Object.fromEntries(r.headers));
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }
      let p = join(PUBLIC, url.pathname);
      if (!existsSync(p) || statSync(p).isDirectory()) p = join(PUBLIC, 'index.html');
      res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream', ...globalHeaders });
      res.end(readFileSync(p));
    } catch (e: any) { console.error(e); res.writeHead(500); res.end(String(e?.message)); }
  }).listen(Number(process.env.PORT), '127.0.0.1', () => console.log('netlify-local up'));
}
main();
