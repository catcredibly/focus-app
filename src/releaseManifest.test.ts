import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import metadata from "../package.json";

it("uses the same notes file verbatim and preserves only matching-version platform signatures", () => {
  const directory = mkdtempSync(join(tmpdir(), "focus-manifest-test-"));
  try {
    const artifact = join(directory, `Shunhen_${metadata.version}_x64-setup.exe`),
      notesFile = join(directory, "notes.md"),
      output = join(directory, "latest.json");
    const notes = '# Fixes\n\n- Quotes "work" and paths C:\\notes\n- 日本語';
    writeFileSync(artifact, "test fixture, not an installer");
    writeFileSync(`${artifact}.sig`, "matching-signature");
    writeFileSync(notesFile, notes);
    writeFileSync(
      output,
      JSON.stringify({
        version: metadata.version,
        platforms: { "linux-x86_64": { signature: "linux-signature", url: "https://example.com/app" } },
      }),
    );
    execFileSync(
      process.execPath,
      [
        resolve("tools/generate-updater-manifest.mjs"),
        "--notes",
        notesFile,
        "--artifact",
        artifact,
        "--repository",
        "catcredibly/shihen",
      ],
      { stdio: "pipe" },
    );
    const manifest = JSON.parse(readFileSync(output, "utf8"));
    expect(manifest.notes).toBe(notes);
    expect(manifest.version).toBe(metadata.version);
    expect(manifest.platforms["windows-x86_64"].signature).toBe("matching-signature");
    expect(manifest.platforms["linux-x86_64"].signature).toBe("linux-signature");
    expect(manifest.platforms["windows-x86_64"].url).toContain(`/v${metadata.version}/Shunhen_${metadata.version}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
