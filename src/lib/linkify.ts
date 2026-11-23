// Split free text (notices, task notes, checklist steps) into plain text and web links.
// Only http(s) links (and bare www. ones, opened as https) become links: never javascript:, mailto: etc.

export type Piece = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
// Punctuation that usually ends a sentence rather than the link.
const TRAILING = /[.,;:!?'"”’)\]}»]+$/;

export function linkify(input: string): Piece[] {
  const pieces: Piece[] = [];
  let last = 0;
  for (const m of input.matchAll(URL_RE)) {
    let raw = m[0];
    const trail = raw.match(TRAILING)?.[0] ?? "";
    // Keep a closing bracket that belongs to the link, e.g. a Wikipedia "(film)" path.
    let cut = trail.length;
    if (trail.startsWith(")") && (raw.slice(0, -cut).match(/\(/g)?.length ?? 0) > (raw.slice(0, -cut).match(/\)/g)?.length ?? 0)) {
      cut -= 1;
    }
    raw = raw.slice(0, raw.length - cut);
    const href = /^www\./i.test(raw) ? `https://${raw}` : raw;
    let ok = false;
    try {
      const u = new URL(href);
      ok = (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
    } catch {}
    if (!ok) continue;
    const start = m.index ?? 0;
    if (start > last) pieces.push({ kind: "text", text: input.slice(last, start) });
    pieces.push({ kind: "link", text: raw, href });
    last = start + raw.length;
  }
  if (last < input.length) pieces.push({ kind: "text", text: input.slice(last) });
  return pieces;
}
