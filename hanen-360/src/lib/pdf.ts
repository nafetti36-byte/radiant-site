/** Minimal PDF 1.4 writer: A4 pages, Helvetica (WinAnsi), headings, paragraphs, tables.
 *  Latin-script text only (French/English); Arabic reports are exported as Excel. */
type Block = { kind: 'h1' | 'h2' | 'p' | 'small'; text: string } | { kind: 'table'; rows: (string | number | null)[][]; widths?: number[] };

const W = 595, H = 842, M = 42;
const toWin = (s: string) => s.normalize('NFC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/ | /g, ' ').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/→/g, '->').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/×/g, 'x').replace(/−/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
const esc = (s: string) => toWin(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const charW = (size: number) => size * 0.5; // average Helvetica glyph width approximation

function wrap(text: string, size: number, width: number): string[] {
  const max = Math.max(4, Math.floor(width / charW(size)));
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      if ((line + ' ' + w).trim().length > max) { if (line) out.push(line); line = w.length > max ? w.slice(0, max) : w; }
      else line = (line + ' ' + w).trim();
    }
    out.push(line);
  }
  return out;
}

export function buildPdf(title: string, blocks: Block[]): Uint8Array {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = H - M;
  const newPage = () => { if (ops.length) pages.push(ops.join('\n')); ops = []; y = H - M; };
  const text = (x: number, size: number, s: string, bold = false) => ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${esc(s)}) Tj ET`);
  const need = (h: number) => { if (y - h < M) newPage(); };

  for (const b of blocks) {
    if (b.kind === 'table') {
      const cols = Math.max(...b.rows.map((r) => r.length));
      const widths = b.widths ?? Array(cols).fill((W - 2 * M) / cols);
      for (let ri = 0; ri < b.rows.length; ri++) {
        const size = 8;
        const cells = b.rows[ri].map((c, ci) => wrap(c === null || c === undefined ? '' : String(c), size, widths[ci] - 4));
        const h = Math.max(...cells.map((c) => c.length)) * (size + 2) + 4;
        need(h);
        if (ri === 0) ops.push(`0.92 0.94 0.97 rg ${M} ${(y - h + size).toFixed(1)} ${W - 2 * M} ${h} re f 0 0 0 rg`);
        let x = M;
        const top = y;
        cells.forEach((lines, ci) => { lines.forEach((ln, li) => { y = top - li * (size + 2); text(x + 2, size, ln, ri === 0); }); x += widths[ci]; });
        y = top - h;
        ops.push(`0.8 0.8 0.8 RG 0.3 w ${M} ${(y + size - 1).toFixed(1)} m ${W - M} ${(y + size - 1).toFixed(1)} l S`);
      }
      y -= 8;
      continue;
    }
    const size = b.kind === 'h1' ? 17 : b.kind === 'h2' ? 12.5 : b.kind === 'small' ? 8 : 10;
    const lines = wrap(b.text, size, W - 2 * M);
    if (b.kind === 'h2') y -= 6;
    for (const ln of lines) { need(size + 4); text(M, size, ln, b.kind === 'h1' || b.kind === 'h2'); y -= size + 4; }
    if (b.kind === 'h1') { ops.push(`0.05 0.35 0.55 RG 1.2 w ${M} ${y + 6} m ${W - M} ${y + 6} l S`); y -= 6; }
  }
  newPage();

  const objs: string[] = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objs[5] = `<< /Title (${esc(title)}) /Producer (Hanen 360) >>`;
  const kids: string[] = [];
  pages.forEach((content, i) => {
    const pageNo = 6 + i * 2, contNo = 7 + i * 2;
    const footer = `BT /F1 7 Tf ${M} 22 Td (${esc(`${title} - page ${i + 1}/${pages.length} - Confidentiel Azur Papier`)}) Tj ET`;
    const body = content + '\n' + footer;
    objs[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contNo} 0 R >>`;
    objs[contNo] = `<< /Length ${latin1Len(body)} >>\nstream\n${body}\nendstream`;
    kids.push(`${pageNo} 0 R`);
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;

  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) { offsets[i] = latin1Len(out); out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
  const xref = latin1Len(out);
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
function latin1Len(s: string) { return s.length; }
export type { Block };
