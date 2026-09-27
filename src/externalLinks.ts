import { invoke, isTauri } from "@tauri-apps/api/core";
export async function openExternalUrl(url: string) {
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Unsupported link protocol");
  if (isTauri()) await invoke("open_external_url", { url: parsed.href });
  else window.open(parsed.href, "_blank", "noopener,noreferrer");
}
