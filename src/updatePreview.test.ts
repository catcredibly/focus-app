import { afterEach, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ enabled: true }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => native.enabled }));
import { updatePreview, previousPreviewVersion } from "./updatePreview";
import { createUpdateController } from "./updater";
afterEach(() => {
  updatePreview.close();
  native.enabled = true;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("previews published notes without changing the real updater or invoking update transports", async () => {
  const fetchNotes = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ body: "## Actual release notes\n- Fixed timing" }) });
  vi.stubGlobal("fetch", fetchNotes);
  vi.stubEnv("DEV", true);
  const check = vi.fn(),
    restart = vi.fn(),
    version = vi.fn();
  const real = createUpdateController({ enabled: () => true, check, restart, version });
  const before = real.getSnapshot();
  await updatePreview.open("2.2.4");
  expect(updatePreview.getSnapshot()).toMatchObject({
    currentVersion: "2.2.3",
    availableVersion: "2.2.4",
    phase: "available",
    promptOpen: true,
    automaticPrompt: false,
  });
  expect(updatePreview.getSnapshot()?.notes).toBe("## Actual release notes\n- Fixed timing");
  expect(fetchNotes.mock.calls[0][0]).toContain("/releases/tags/v2.2.4");
  updatePreview.close();
  expect(updatePreview.getSnapshot()).toBeNull();
  expect(real.getSnapshot()).toBe(before);
  expect(check).not.toHaveBeenCalled();
  expect(restart).not.toHaveBeenCalled();
  expect(version).not.toHaveBeenCalled();
});
it("does not open outside native development builds", () => {
  vi.stubEnv("DEV", false);
  updatePreview.open("2.2.0");
  expect(updatePreview.getSnapshot()).toBeNull();
  vi.stubEnv("DEV", true);
  native.enabled = false;
  updatePreview.open("2.2.0");
  expect(updatePreview.getSnapshot()).toBeNull();
});

it("uses valid baseline versions and falls back safely when notes cannot load", async () => {
  expect(previousPreviewVersion("2.3.0")).toBe("2.2.0");
  expect(previousPreviewVersion("3.0.0")).toBe("2.0.0");
  vi.stubEnv("DEV", true);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await updatePreview.open("2.3.0");
  expect(updatePreview.getSnapshot()?.notes).toBeUndefined();
});
it("does not reopen a dismissed preview after notes arrive", async () => {
  vi.stubEnv("DEV", true);
  let resolve!: (value: unknown) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  );
  const opening = updatePreview.open("2.2.4");
  updatePreview.close();
  resolve({ ok: true, json: async () => ({ body: "late" }) });
  await opening;
  expect(updatePreview.getSnapshot()).toBeNull();
});
