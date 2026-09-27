import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReleaseNotes } from "./ReleaseNotes";
import { noteSnippet } from "../notes";

export function NoteSnippet({ note, terms }: { note: string; terms: string[] }) {
  const snippet = noteSnippet(note, terms);
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return (
    <div className="history-note-snippet">
      {snippet.split(pattern).map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part))}
    </div>
  );
}

export function NoteViewer({ note, anchor, onClose }: { note: string; anchor: HTMLElement; onClose: () => void }) {
  const { t } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ left: 16, top: 16, width: 440, maxHeight: 360 });
  useLayoutEffect(() => {
    const place = () => {
      const margin = Math.min(16, window.innerWidth / 4, window.innerHeight / 4);
      const width = Math.max(0, Math.min(440, window.innerWidth - margin * 2));
      const maxHeight = Math.max(0, Math.min(360, window.innerHeight - margin * 2));
      const rect = anchor.getBoundingClientRect();
      setPosition({
        width,
        maxHeight,
        left: Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin)),
        top: Math.max(margin, Math.min(rect.bottom + 6, window.innerHeight - maxHeight - margin)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);
  useEffect(() => {
    closeButton.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        anchor.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [anchor, onClose]);
  return createPortal(
    <div ref={panel} role="dialog" aria-label={t("View note")} className="history-note-viewer" style={position}>
      <header>
        <strong>{t("Note")}</strong>
        <button
          ref={closeButton}
          type="button"
          aria-label={t("Close")}
          onClick={() => {
            onClose();
            anchor.focus();
          }}
        >
          <X size={18} />
        </button>
      </header>
      <div className="history-note-body">
        <ReleaseNotes notes={note} />
      </div>
    </div>,
    document.body,
  );
}
