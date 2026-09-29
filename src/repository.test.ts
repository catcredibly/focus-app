import { describe, expect, it } from "vitest";
import metadata from "../package.json";
import tauri from "../src-tauri/tauri.conf.json";

describe("canonical repository identity", () => {
  it("keeps metadata and updater on catcredibly/shunhen", () => {
    const repository = "https://github.com/catcredibly/shunhen";
    expect(metadata.repository.url).toBe(`git+${repository}.git`);
    expect(metadata.homepage).toBe(`${repository}#readme`);
    expect(tauri.plugins.updater.endpoints).toEqual([`${repository}/releases/latest/download/latest.json`]);
  });
});

it("changes display branding without changing installation identity", () => {
  expect(tauri.productName).toBe("Shunhen");
  expect(tauri.identifier).toBe("com.focus.timer");
  expect(tauri.version).toBe("../package.json");
  expect(tauri.bundle.publisher).toBe("focus");
  for (const window of tauri.app.windows) expect(window.title).toMatch(/^Shunhen(?: |$)/);
});
