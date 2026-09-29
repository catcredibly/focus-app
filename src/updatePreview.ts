import { isTauri } from "@tauri-apps/api/core";
import type { UpdateState } from "./updater";
import metadata from "../package.json";

export function previousPreviewVersion(version: string) {
  const [major, minor, patch] = version.split(".").map(part => parseInt(part, 10) || 0);
  // At a new minor/major boundary, use its previous baseline rather than inventing a patch history.
  return patch > 0 ? `${major}.${minor}.${patch - 1}` : minor > 0 ? `${major}.${minor - 1}.0` : `${Math.max(0, major - 1)}.0.0`;
}
let generation = 0;

// Deliberately owns no updater candidate, IPC, download, or relaunch functions.
let state: UpdateState | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());
export const updatePreview = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => state,
  open: async (currentVersion: string) => {
    if (!import.meta.env.DEV || !isTauri()) return;
    const request = ++generation;
    state = {
      phase: "available",
      currentVersion: previousPreviewVersion(currentVersion),
      availableVersion: currentVersion,
      promptOpen: true,
      automaticPrompt: false,
      downloaded: 0,

    };
    publish();
    try {
      const repository = new URL(metadata.homepage).pathname.replace(/^\/|\/$/g, "");
      const response = await fetch(`https://api.github.com/repos/${repository}/releases/tags/v${encodeURIComponent(currentVersion)}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return;
      const release: { body?: unknown } = await response.json();
      if (request !== generation || !state) return;
      state = { ...state, notes: typeof release.body === "string" ? release.body : undefined };
      publish();
    } catch { /* Offline/unpublished releases use the real dialog's existing fallback. */ }
  },
  close: () => {
    generation++;
    state = null;
    publish();
  },
};
