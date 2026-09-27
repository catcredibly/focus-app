import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { meaningfulReleaseNotes } from "./releaseNotes";
import { ReleaseNotes } from "./components/ReleaseNotes";
it("hides absent/generic notes and strips repeated release headings", () => {
  expect(meaningfulReleaseNotes()).toBe("");
  expect(meaningfulReleaseNotes("Focus 2.1.1 / Update available")).toBe("");
  expect(meaningfulReleaseNotes("# Focus 2.1.1\nUpdate available\n\n- Fixed reset")).toBe("- Fixed reset");
});
it("renders a bounded Markdown subset without interpreting raw HTML or unsafe links", () => {
  const html = renderToStaticMarkup(
    <ReleaseNotes
      notes={
        "## Fixes\n- **Reset** and `shortcuts`\n\n<script>alert(1)</script>\n[jump](javascript:alert) [notes](https://example.com)"
      }
    />,
  );
  expect(html).toContain("<strong>Reset</strong>");
  expect(html).toContain("<code>shortcuts</code>");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain('href="https://example.com"');
});
it("retains long meaningful notes for the scrollable renderer", () => {
  const notes = Array.from({ length: 500 }, (_, i) => `- Fix ${i}`).join("\n");
  expect(meaningfulReleaseNotes(notes)).toBe(notes);
});
