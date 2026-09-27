import { describe, expect, it } from "vitest";
import {
  classifyUpdateError,
  sanitizeUpdateError,
  UpdateCheckError,
  validateManifest,
  type ManifestProbe,
} from "./updateDiagnostics";
const signature = btoa(
  `untrusted comment: test\n${btoa("x".repeat(74))}\ntrusted comment: test\n${btoa("x".repeat(64))}`,
);
const valid = {
  version: "1.3.0",
  platforms: { "windows-x86_64": { url: "https://example.com/update.exe", signature } },
};
const probe = (data: unknown): ManifestProbe => ({
  endpoint: "https://example.com/latest.json",
  status: 200,
  body: JSON.stringify(data),
});
const category = (value: ManifestProbe) => {
  try {
    validateManifest(value);
    return "valid";
  } catch (error) {
    return classifyUpdateError(error);
  }
};
describe("updater diagnostics", () => {
  it("distinguishes private/inaccessible repositories from confirmed missing manifests", () => {
    expect(category({ endpoint: "", status: 404, repositoryStatus: 404 })).toBe("inaccessible");
    expect(category({ endpoint: "", status: 404, repositoryStatus: 200 })).toBe("manifest-missing");
    expect(category({ endpoint: "", status: 403 })).toBe("inaccessible");
  });
  it("validates Windows manifest shape without claiming to verify its signature", () => {
    expect(category(probe(valid))).toBe("valid");
    expect(category(probe({ version: "1.3.0", platforms: {} }))).toBe("platform-missing");
    expect(category({ endpoint: "", status: 200, body: "<html>" })).toBe("malformed-manifest");
    expect(
      category(
        probe({
          ...valid,
          platforms: { "windows-x86_64": { url: "https://example.com/app.exe", signature: "invalid" } },
        }),
      ),
    ).toBe("signature");
    expect(category(probe({ ...valid, platforms: { "windows-x86_64-nsis": valid.platforms["windows-x86_64"] } }))).toBe(
      "valid",
    );
  });
  it("classifies transport/config/signature failures and redacts credentials", () => {
    expect(classifyUpdateError("request timed out")).toBe("timeout");
    expect(classifyUpdateError("TLS certificate failure")).toBe("network");
    expect(classifyUpdateError("plugin not allowed")).toBe("configuration");
    expect(classifyUpdateError("signature verification failed")).toBe("signature");
    expect(classifyUpdateError(new UpdateCheckError("manifest-missing", "404"))).toBe("manifest-missing");
    expect(
      sanitizeUpdateError("https://user:secret@example.com/update?token=secret Bearer secret github_pat_secret"),
    ).not.toContain("secret");
  });
});
