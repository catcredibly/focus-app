const isTauri = () => "__TAURI_INTERNALS__" in window;

export async function saveTextFile(defaultName: string, contents: string, kind: "json" | "csv") {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: defaultName, filters: [{ name: kind.toUpperCase(), extensions: [kind] }] });
    if (!path) return false;
    await writeTextFile(path, contents);
    return true;
  }
  const picker = (
    window as Window & {
      showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{
        createWritable: () => Promise<{ write: (text: string) => Promise<void>; close: () => Promise<void> }>;
      }>;
    }
  ).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: defaultName });
      const stream = await handle.createWritable();
      await stream.write(contents);
      await stream.close();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      throw error;
    }
  }
  const blob = new Blob([contents], { type: kind === "json" ? "application/json" : "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = defaultName;
  anchor.click();
  URL.revokeObjectURL(url);
  // A browser download has no write-completion signal. Never claim disk success.
  return false;
}

export async function chooseTextFile() {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({ multiple: false, filters: [{ name: "Shunhen data", extensions: ["json", "csv"] }] });
    if (!path) return null;
    return { name: String(path).split(/[\\/]/).pop() ?? "data", text: await readTextFile(path) };
  }
  return new Promise<{ name: string; text: string } | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.csv,application/json,text/csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, text: await file.text() } : null);
    };
    input.click();
  });
}
