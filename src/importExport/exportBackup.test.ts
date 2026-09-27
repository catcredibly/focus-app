import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), toast: vi.fn(), setting: vi.fn() }));
vi.mock("./files", () => ({ saveTextFile: mocks.save }));
vi.mock("./backup", () => ({ createBackup: async () => ({}), backupFilename: () => "test.json" }));
vi.mock("../settings", () => ({ saveSetting: mocks.setting }));
vi.mock("../toasts", () => ({ showToast: mocks.toast }));
import { exportFullBackup } from "./exportBackup";
beforeEach(() => {
  vi.clearAllMocks();
});
it("shows success only after a completed write", async () => {
  mocks.save.mockResolvedValueOnce(false);
  await exportFullBackup();
  expect(mocks.toast).not.toHaveBeenCalled();
  mocks.save.mockRejectedValueOnce(new Error("write failed"));
  await expect(exportFullBackup()).rejects.toThrow("write failed");
  expect(mocks.toast).not.toHaveBeenCalled();
  mocks.save.mockResolvedValueOnce(true);
  await exportFullBackup();
  expect(mocks.toast).toHaveBeenCalledWith("Backup exported successfully");
});
