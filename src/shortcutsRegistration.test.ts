import { beforeEach, expect, it, vi } from "vitest";
import { registerRevealShortcut } from "./shortcuts";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), save: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, invoke: mocks.invoke }));
vi.mock("./settings", () => ({
  loadSettings: async () => ({ popoutRevealShortcut: "Ctrl+KeyR", popoutShortcutEnabled: true }),
  saveSetting: mocks.save,
}));
beforeEach(() => {
  mocks.invoke.mockReset().mockResolvedValue(undefined);
  mocks.save.mockReset().mockResolvedValue(undefined);
});

it("persists only after successful registration", async () => {
  await registerRevealShortcut("Alt+Backquote", true);
  expect(mocks.invoke).toHaveBeenCalledWith("set_reveal_shortcut", { shortcut: "Alt+Backquote" });
  expect(mocks.save).toHaveBeenCalledWith("popoutRevealShortcut", "Alt+Backquote");
  expect(mocks.invoke.mock.invocationCallOrder[0]).toBeLessThan(mocks.save.mock.invocationCallOrder[0]);
});
it("leaves the saved shortcut intact when native registration fails", async () => {
  mocks.invoke.mockRejectedValueOnce(new Error("already registered"));
  await expect(registerRevealShortcut("Alt+Backquote", true)).rejects.toThrow("already registered");
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
});
it("restores the previous native shortcut when persistence fails", async () => {
  mocks.save.mockRejectedValueOnce(new Error("storage failed"));
  await expect(registerRevealShortcut("Alt+Backquote", true)).rejects.toThrow("storage failed");
  expect(mocks.invoke).toHaveBeenLastCalledWith("set_reveal_shortcut", { shortcut: "Ctrl+KeyR" });
});

it("clears native registration before persisting an empty shortcut", async () => {
  await registerRevealShortcut("", true);
  expect(mocks.invoke).toHaveBeenCalledWith("set_reveal_shortcut", { shortcut: "" });
  expect(mocks.save).toHaveBeenCalledWith("popoutRevealShortcut", "");
});

it("unregisters without clearing the saved key when disabled", async () => {
  await registerRevealShortcut("Ctrl+KeyR");
  await registerRevealShortcut("");
  expect(mocks.invoke).toHaveBeenLastCalledWith("set_reveal_shortcut", { shortcut: "" });
  expect(mocks.save).not.toHaveBeenCalled();
  await registerRevealShortcut("Ctrl+KeyR");
  expect(mocks.invoke).toHaveBeenLastCalledWith("set_reveal_shortcut", { shortcut: "Ctrl+KeyR" });
});
