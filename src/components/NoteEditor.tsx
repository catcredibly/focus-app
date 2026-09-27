import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { noteMetrics, notePreview } from "../notes";

export function NoteEditor({ value, onChange }: { value: string; onChange: (note: string) => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const metrics = noteMetrics(value);
  useLayoutEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = "auto";
    const style = getComputedStyle(node);
    const cap = parseFloat(style.lineHeight) * 6 + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 2;
    node.style.height = `${Math.min(node.scrollHeight + 2, cap)}px`;
  }, [editing, value]);
  return (
    <div className="session-note-editor">
      {editing ? (
        <textarea
          ref={textarea}
          autoFocus
          rows={1}
          className="note-field"
          aria-label={t("Session note")}
          aria-invalid={!metrics.valid}
          value={value}
          placeholder={t("Add a note (optional)...")}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => {
            if (metrics.valid) {
              setEditing(false);
              return;
            }
            const target = event.relatedTarget as HTMLElement | null;
            // Explicit navigation/dismissal must remain possible. Ordinary form
            // interaction returns to the intact invalid draft.
            if (target?.closest(".sidebar, [data-note-exit]")) return;
            if (document.hasFocus()) requestAnimationFrame(() => textarea.current?.focus());
          }}
        />
      ) : (
        <button
          type="button"
          className="note-field note-preview"
          aria-label={t("Session note")}
          onFocus={() => setEditing(true)}
        >
          {notePreview(value) || <span>{t("Add a note (optional)...")}</span>}
        </button>
      )}
      {(metrics.characters >= 1000 || metrics.lines > 40) && (
        <div className="note-limits" aria-live="polite">
          <span className="field-error">{metrics.lines > 40 ? t("Maximum 40 lines.") : ""}</span>
          {metrics.characters >= 1000 && (
            <span className={metrics.characters >= 1150 ? "field-error" : ""}>{metrics.characters} / 1200</span>
          )}
        </div>
      )}
    </div>
  );
}
