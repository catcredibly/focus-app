export type NoteToken = { raw: string; label?: string; url?: string };

/** Shared link grammar for counting, previews, search and the safe Markdown renderer. */
export function noteTokens(text: string): NoteToken[] {
  const tokens: NoteToken[] = [];
  const pattern = /\[([^\]\n]+)\]\(/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! < cursor || (match.index! > 0 && text[match.index! - 1] === "\\")) continue;
    const urlStart = match.index! + match[0].length;
    let end = urlStart,
      depth = 1;
    for (; end < text.length; end++) {
      if (/\s/.test(text[end])) break;
      if (text[end] === "(") depth++;
      if (text[end] === ")" && --depth === 0) break;
    }
    if (depth !== 0) continue;
    const url = text.slice(urlStart, end);
    try {
      if (!["https:", "http:"].includes(new URL(url).protocol)) continue;
    } catch {
      continue;
    }
    if (match.index! > cursor) tokens.push({ raw: text.slice(cursor, match.index) });
    tokens.push({ raw: text.slice(match.index, end + 1), label: match[1], url });
    cursor = end + 1;
  }
  if (cursor < text.length) tokens.push({ raw: text.slice(cursor) });
  return tokens;
}

function plainFormatting(text: string): string {
  return text
    .replace(/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s?)/gm, "")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_/g, (_all, ...parts: unknown[]) =>
      String(parts.slice(0, 5).find((part) => part !== undefined) ?? ""),
    );
}
export function readableNote(note: string): string {
  return plainFormatting(
    noteTokens(note)
      .map((token) => token.label ?? token.raw)
      .join(""),
  );
}
export function noteMetrics(note: string) {
  const characters = noteTokens(note).reduce(
    (sum, token) => sum + Array.from(token.label === undefined ? token.raw : plainFormatting(token.label)).length,
    0,
  );
  const lines = note.split(/\r\n|\r|\n/).length;
  return { characters, lines, valid: characters <= 1200 && lines <= 40 };
}
export function normalizeNote(note: string): string {
  if (noteMetrics(note).valid) return note;
  // Keep complete links whenever their visible label fits. Never cut a URL into
  // malformed Markdown that would suddenly count its hidden destination.
  let result = "";
  for (const token of noteTokens(note)) {
    if (noteMetrics(result + token.raw).valid) {
      result += token.raw;
      continue;
    }
    const content = token.label === undefined ? token.raw : plainFormatting(token.label);
    let prefix = "";
    for (const point of content) {
      const next = prefix + point;
      const candidate = result + (token.url ? `[${next}](${token.url})` : next);
      if (!noteMetrics(candidate).valid) break;
      prefix = next;
    }
    result += token.url && prefix ? `[${prefix}](${token.url})` : prefix;
    break;
  }
  return result;
}
export function notePreview(note: string): string {
  const lines = readableNote(note)
    .split(/\r?\n/)
    .filter((line) => line.trim());
  return (lines[0]?.trim() ?? "") + (lines.length > 1 ? "…" : "");
}
export function noteSearchTerms(query: string): string[] {
  return [...new Set(query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))];
}
export function matchesNote(note: string | undefined, terms: string[]): boolean {
  const text = readableNote(note ?? "").toLocaleLowerCase();
  return terms.every((term) => text.includes(term));
}
export function noteSnippet(note: string, terms: string[]): string {
  const text = readableNote(note).replace(/\s+/g, " ").trim();
  const positions = terms.map((term) => text.toLocaleLowerCase().indexOf(term)).filter((index) => index >= 0);
  const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 35);
  const end = Math.min(text.length, start + 220);
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
