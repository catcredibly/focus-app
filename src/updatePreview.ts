import { isTauri } from "@tauri-apps/api/core";
import type { UpdateState } from "./updater";
import metadata from "../package.json";
import { meaningfulReleaseNotes } from "./releaseNotes";

export function previousPreviewVersion(version: string) {
  const [major, minor, patch] = version.split(".").map((part) => parseInt(part, 10) || 0);
  // At a new minor/major boundary, use its previous baseline rather than inventing a patch history.
  return patch > 0
    ? `${major}.${minor}.${patch - 1}`
    : minor > 0
      ? `${major}.${minor - 1}.0`
      : `${Math.max(0, major - 1)}.0.0`;
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
    let notes: string | undefined;
    // This is the same Markdown source used to publish the release and latest.json.
    // A glob keeps it optional in checkouts where release notes have not been prepared.
    if (import.meta.env.DEV && currentVersion === metadata.version) {
      try {
        const sources = import.meta.glob<string>("../RELEASE_NOTES.md", { query: "?raw", import: "default" });
        notes = await sources["../RELEASE_NOTES.md"]?.();
      } catch {
        // Fall back to published notes if the local release source is unavailable.
      }
    }
    if (!meaningfulReleaseNotes(notes)) {
      try {
        const repository = new URL(metadata.homepage).pathname.replace(/^\/|\/$/g, "");
        const response = await fetch(
          `https://api.github.com/repos/${repository}/releases/tags/v${encodeURIComponent(currentVersion)}`,
          { signal: AbortSignal.timeout(10000) },
        );
        if (!response.ok) throw new Error("Release notes unavailable");
        const release: { body?: unknown } = await response.json();
        notes = typeof release.body === "string" ? release.body : undefined;
      } catch {
        /* Offline/unpublished releases use the real dialog's existing fallback. */
      }
    }
    if (request !== generation) return;
    state = {
      phase: "available",
      currentVersion: previousPreviewVersion(currentVersion),
      availableVersion: currentVersion,
      notes,
      promptOpen: true,
      automaticPrompt: false,
      downloaded: 0,
    };
    publish();
  },
  // Inject safe actions into the real dialog; never own or call an updater candidate.
  install: async () => {},
  dontShowAgain: async () => {},
  close: () => {
    generation++;
    state = null;
    publish();
  },
};
