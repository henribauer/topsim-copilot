/**
 * A deliberately tiny Markdown reader for the copilot's answers: headings, paragraphs, bullet and numbered
 * lists, **bold**, and ⟦n⟧ citation markers. It produces data, not HTML — React renders text nodes, so
 * nothing the model writes can ever become markup (no library needed, nothing loaded from outside).
 */
export type Inline = { text: string; bold?: true } | { cite: number };

export type Block =
  | { type: "heading"; level: number; inline: Inline[] }
  | { type: "paragraph"; inline: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

function inline(text: string): Inline[] {
  const out: Inline[] = [];
  // One pass over **bold** and ⟦n⟧; everything between is plain text.
  const re = /\*\*([^*]+)\*\*|⟦(\d+)⟧/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { text: m[1], bold: true } : { cite: Number(m[2]) });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;
  const flush = () => {
    if (para.length) blocks.push({ type: "paragraph", inline: inline(para.join(" ")) });
    if (list) blocks.push({ type: "list", ...list });
    para = [];
    list = null;
  };
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const item = /^(?:([-*•])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (line === "" || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1].length, inline: inline(heading[2]) });
    } else if (item) {
      const ordered = item[2] !== undefined;
      if (para.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push(inline(item[3]));
    } else {
      if (list) flush();
      para.push(line);
    }
  }
  flush();
  return blocks;
}
