import React from "react";

/** Minimal, safe Markdown renderer (no raw HTML): headings, lists, bold, italics, code, links, tables. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|https?:\/\/[^\s)]+)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0], k = `${key}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) { const label = tok.slice(1, tok.indexOf("]")); out.push(<a key={k} href={m[2]} target="_blank" rel="noreferrer noopener">{label}</a>); }
    else if (tok.startsWith("http")) out.push(<a key={k} href={tok} target="_blank" rel="noreferrer noopener">{tok}</a>);
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [], table: string[][] = [], para: string[] = [];
  const flush = (k: number) => {
    if (para.length) { blocks.push(<p key={`p${k}`}>{inline(para.join(" "), `p${k}`)}</p>); para = []; }
    if (list.length) { blocks.push(<ul key={`l${k}`}>{list.map((l, i) => <li key={i}>{inline(l, `l${k}-${i}`)}</li>)}</ul>); list = []; }
    if (table.length) {
      const [head, ...rows] = table.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c.trim())));
      blocks.push(<div key={`t${k}`} style={{ overflowX: "auto" }}><table><thead><tr>{head.map((c, i) => <th key={i}>{inline(c, `th${k}${i}`)}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c, `td${k}${ri}${ci}`)}</td>)}</tr>)}</tbody></table></div>);
      table = [];
    }
  };
  lines.forEach((raw, k) => {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(k); const Tag = (`h${Math.min(h[1].length + 1, 4)}`) as "h2"; blocks.push(<Tag key={`h${k}`}>{inline(h[2], `h${k}`)}</Tag>); return; }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) { if (para.length || table.length) flush(k); list.push(line.replace(/^\s*([-*]|\d+\.)\s+/, "")); return; }
    if (/^\|.*\|$/.test(line.trim())) { if (para.length || list.length) flush(k); table.push(line.trim().slice(1, -1).split("|").map((c) => c.trim())); return; }
    if (!line.trim()) { flush(k); return; }
    if (list.length || table.length) flush(k);
    para.push(line);
  });
  flush(lines.length);
  return <div className="md">{blocks}</div>;
}
