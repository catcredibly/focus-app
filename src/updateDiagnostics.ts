import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";

export type UpdateCategory =
  | "manifest-missing"
  | "inaccessible"
  | "network"
  | "malformed-manifest"
  | "platform-missing"
  | "signature"
  | "configuration"
  | "timeout"
  | "service"
  | "no-update"
  | "available";
export type ManifestProbe = {
  endpoint: string;
  status?: number;
  repositoryStatus?: number;
  body?: string;
  error?: string;
  category?: UpdateCategory;
};
export class UpdateCheckError extends Error {
  constructor(
    public category: UpdateCategory,
    message: string,
  ) {
    super(message);
  }
}
export function classifyUpdateError(error: unknown): UpdateCategory {
  if (error instanceof UpdateCheckError) return error.category;
  const message = String(error);
  if (/timed?\s*out|timeout/i.test(message)) return "timeout";
  if (/signature|public.?key|base64|minisign/i.test(message)) return "signature";
  if (/target.*not.*found|platform/i.test(message)) return "platform-missing";
  if (/json|deserialize|missing field|invalid.*version/i.test(message)) return "malformed-manifest";
  if (/config|endpoint|plugin|not allowed|unavailable|permission/i.test(message)) return "configuration";
  if (/401|403|unauthorized|forbidden/i.test(message)) return "inaccessible";
  if (/network|dns|tls|certificate|connect|resolve|offline|request/i.test(message)) return "network";
  return "service";
}
export function sanitizeUpdateError(error: unknown) {
  return String(error)
    .replace(/https?:\/\/[^\s)"']+/g, (value) => {
      try {
        const url = new URL(value);
        return `${url.protocol}//${url.hostname}${url.pathname}`;
      } catch {
        return "[URL]";
      }
    })
    .replace(/(?:Bearer\s+|gh[pousr]_|github_pat_)[\w.-]+/gi, "[redacted]")
    .slice(0, 600);
}
export function validateManifest(probe: ManifestProbe, target = "windows-x86_64") {
  if (probe.category) throw new UpdateCheckError(probe.category, probe.error ?? probe.category);
  if (probe.status === 404)
    throw new UpdateCheckError(
      probe.repositoryStatus === 200 ? "manifest-missing" : "inaccessible",
      `Manifest HTTP 404; repository HTTP ${probe.repositoryStatus ?? "unknown"}`,
    );
  if (probe.status === 401 || probe.status === 403)
    throw new UpdateCheckError("inaccessible", `Manifest HTTP ${probe.status}`);
  if (probe.status === 204) return;
  if (probe.status !== 200) throw new UpdateCheckError("service", `Manifest HTTP ${probe.status ?? "unknown"}`);
  let manifest: { version?: unknown; platforms?: Record<string, { url?: unknown; signature?: unknown }> };
  try {
    manifest = JSON.parse(probe.body ?? "");
  } catch {
    throw new UpdateCheckError("malformed-manifest", "Manifest is not JSON");
  }
  if (!manifest || typeof manifest.version !== "string" || !/^v?\d+\.\d+\.\d+(?:[-+][\w.+-]+)?$/.test(manifest.version))
    throw new UpdateCheckError("malformed-manifest", "Manifest has no valid version");
  const platform = manifest.platforms?.[`${target}-nsis`] ?? manifest.platforms?.[target];
  if (!platform) throw new UpdateCheckError("platform-missing", `Manifest has no ${target} entry`);
  try {
    if (typeof platform.url !== "string" || new URL(platform.url).protocol !== "https:") throw new Error();
  } catch {
    throw new UpdateCheckError("malformed-manifest", "Platform URL must use HTTPS");
  }
  try {
    if (typeof platform.signature !== "string") throw new Error();
    const lines = atob(platform.signature).trim().split(/\r?\n/);
    if (
      !lines[0].startsWith("untrusted comment:") ||
      atob(lines[1]).length !== 74 ||
      !lines[2].startsWith("trusted comment:") ||
      atob(lines[3]).length !== 64
    )
      throw new Error();
  } catch {
    throw new UpdateCheckError("signature", "Platform signature data is missing or malformed");
  }
}
function diagnostic(manual: boolean, probe: ManifestProbe | undefined, category: UpdateCategory, error?: unknown) {
  if (import.meta.env.DEV)
    console.info("Shunhen updater", {
      check: manual ? "manual" : "automatic",
      endpoint: probe?.endpoint ? sanitizeUpdateError(probe.endpoint) : "configured endpoint unavailable",
      status: probe?.status,
      category,
      error: error === undefined ? undefined : sanitizeUpdateError(error),
      manifestFetched: probe?.body !== undefined,
    });
}
export async function checkWithDiagnostics(manual: boolean) {
  let probe: ManifestProbe | undefined;
  try {
    probe = await invoke<ManifestProbe>("probe_update_manifest");
    validateManifest(probe);
    // Shape checks provide useful errors; only Tauri verifies signatures against
    // the public key. Never substitute this preflight for its security checks.
    const update = probe.status === 204 ? null : await check({ timeout: 10_000 });
    diagnostic(manual, probe, update ? "available" : "no-update");
    return update;
  } catch (error) {
    const category = classifyUpdateError(error);
    diagnostic(manual, probe, category, error);
    throw new UpdateCheckError(category, sanitizeUpdateError(error));
  }
}
