import { expect, it } from "vitest";
import {
  matchesNote,
  normalizeNote,
  noteMetrics,
  notePreview,
  noteSearchTerms,
  noteSnippet,
  readableNote,
} from "./notes";

it("counts code points and visible Markdown link labels, retaining invalid active drafts", () => {
  expect(noteMetrics("😀[study](https://example.com/long-url)").characters).toBe(6);
  expect(noteMetrics("https://example.com").characters).toBe(19);
  expect(noteMetrics("[Wiki](https://example.com/A_(B))").characters).toBe(4);
  const draft = "😀".repeat(1201);
  expect(noteMetrics(draft)).toMatchObject({ characters: 1201, valid: false });
  expect(Array.from(draft)).toHaveLength(1201);
  expect(noteMetrics("\n".repeat(40))).toMatchObject({ lines: 41, valid: false });
  expect(noteMetrics("[study](https://example.com").characters).toBe(27);
});

it("normalizes legacy notes deterministically without breaking links or Unicode", () => {
  for (const note of ["😀".repeat(1201), "a\n".repeat(50), "x".repeat(1199) + "[abc](https://example.com/long)"]) {
    const normalized = normalizeNote(note);
    expect(noteMetrics(normalized).valid).toBe(true);
    expect(normalizeNote(normalized)).toBe(normalized);
    expect(normalized).not.toContain("\uFFFD");
  }
  expect(normalizeNote("x".repeat(1199) + "[abc](https://example.com/long)")).toBe(
    "x".repeat(1199) + "[a](https://example.com/long)",
  );
  const valid = "\n# Heading\n\n**Study** [today](https://example.com)\n";
  expect(normalizeNote(valid)).toBe(valid);
  expect(notePreview(valid)).toBe("Heading…");
});

it("searches readable notes with case-insensitive, order-independent AND terms", () => {
  const note = "# Algebra\nReview **chapter** one and [exercises](https://hidden.example/solutions)";
  expect(matchesNote(note, noteSearchTerms("  EXERCISES   algebra "))).toBe(true);
  expect(matchesNote(note, noteSearchTerms("algebra geometry"))).toBe(false);
  expect(matchesNote(note, ["hidden.example"])).toBe(false);
  expect(readableNote(note)).not.toContain("**");
  expect(matchesNote("Plain https://example.com", ["example.com"])).toBe(true);
});

it("retains case in case-sensitive terms and locates a matching readable snippet", () => {
  const note = "prefix ".repeat(40) + "[Algebra](https://hidden.example) Chapter";
  const terms = noteSearchTerms("Chapter Algebra", true);
  expect(terms).toEqual(["Chapter", "Algebra"]);
  expect(terms.every((term) => readableNote(note).includes(term))).toBe(true);
  expect(noteSearchTerms("chapter", true).every((term) => readableNote(note).includes(term))).toBe(false);
  expect(noteSnippet(note, terms, true)).toContain("Algebra");
  expect(noteSnippet(note, terms, true)).not.toContain("hidden.example");
});
