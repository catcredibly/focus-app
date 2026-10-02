import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn(), synchronize: vi.fn() }));
vi.mock("./settings", () => ({ loadSettings: mocks.load }));
vi.mock("./autostart", () => ({ synchronizeStartup: mocks.synchronize }));
import { createSettingsInitializer } from "./settingsInitialization";
beforeEach(() => {
  mocks.load.mockReset().mockResolvedValue({});
  mocks.synchronize.mockReset().mockResolvedValue(undefined);
});
it("shares initialization across concurrent mounts and later mounts", async () => {
  const initialize = createSettingsInitializer();
  const first = initialize();
  expect(initialize()).toBe(first);
  await Promise.all([first, initialize(), initialize()]);
  await initialize();
  expect(mocks.load).toHaveBeenCalledTimes(1);
  expect(mocks.synchronize).toHaveBeenCalledTimes(1);
});
it("retries failed loading on a later mount", async () => {
  const initialize = createSettingsInitializer();
  mocks.load.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(initialize()).rejects.toThrow("database unavailable");
  await initialize();
  expect(mocks.load).toHaveBeenCalledTimes(2);
  expect(mocks.synchronize).toHaveBeenCalledTimes(1);
});
it("logs native reconciliation errors and allows a later retry", async () => {
  const initialize = createSettingsInitializer();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    mocks.synchronize.mockRejectedValueOnce(new Error("native unavailable"));
    await initialize();
    expect(log).toHaveBeenCalledTimes(1);
    await initialize();
    expect(mocks.synchronize).toHaveBeenCalledTimes(2);
  } finally {
    log.mockRestore();
  }
});
