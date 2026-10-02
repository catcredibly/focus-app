import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { meaningfulReleaseNotes } from "./releaseNotes";
import { ReleaseNotes } from "./components/ReleaseNotes";
it("hides absent/generic notes and strips repeated release headings", () => {
  expect(meaningfulReleaseNotes()).toBe("");
  expect(meaningfulReleaseNotes("# Shunhen 2.2.3\n- Updated branding")).toBe("- Updated branding");
  expect(meaningfulReleaseNotes("# Shihen 2.2.2\n- Older release")).toBe("- Older release");
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

it("renders consecutive Session note bullets following a paragraph without requiring a blank line", () => {
  const html = renderToStaticMarkup(
    <ReleaseNotes
      notes={[
        "Reviewed yesterday's mistakes and completed a timed practice set.",
        "- Reworked errors involving operator methods and commutators.",
        "- Reviewed normalization and expectation-value calculations.",
        "- Practiced solving time-independent Schrödinger equation problems under time pressure.",
        "- Checked mistakes involving angular momentum and eigenstates.",
        "- Reviewed when to use perturbation theory approximations.",
        "- Identified algebra and notation errors that caused lost marks.",
        "- Noted which derivations and standard results still need faster recall.",
      ].join("\n")}
    />,
  );
  expect(html).toContain("<p>Reviewed yesterday&#x27;s mistakes and completed a timed practice set.</p><ul>");
  expect(html.match(/<li>/g)).toHaveLength(7);
  expect(html).toContain("<li>Reworked errors involving operator methods and commutators.</li>");
});
