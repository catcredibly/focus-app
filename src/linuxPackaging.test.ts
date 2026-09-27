import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import linux from "../src-tauri/tauri.linux.conf.json";
import shared from "../src-tauri/tauri.conf.json";

it("supplies existing square PNGs for both Linux package formats", () => {
  expect(linux.bundle.targets).toEqual(["appimage", "deb"]);
  for (const icon of linux.bundle.icon) {
    const bytes = readFileSync(new URL(`../src-tauri/${icon}`, import.meta.url));
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBeGreaterThan(0);
    expect(bytes.readUInt32BE(16)).toBe(bytes.readUInt32BE(20));
  }
});
it("keeps the platform override limited to Linux packaging", () => {
  expect(Object.keys(linux).sort()).toEqual(["$schema", "bundle"]);
  expect(Object.keys(linux.bundle).sort()).toEqual(["icon", "linux", "targets"]);
  expect(linux.bundle.linux.deb).toEqual({ replaces: ["focus"], conflicts: ["focus"], provides: ["focus"] });
  expect(shared.bundle.targets).toEqual(["nsis"]);
  expect(shared.bundle.createUpdaterArtifacts).toBe(true);
});
