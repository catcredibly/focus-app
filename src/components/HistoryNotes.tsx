import { useEffect, useLayoutEffect, useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReleaseNotes } from "./ReleaseNotes";
import { noteSnippet, readableNote } from "../notes";

export function NoteSnippet({
  note,
  terms,
  matchCase = false,
}: {
  note: string;
  terms: string[];
  matchCase?: boolean;
}) {
  const snippet = noteSnippet(note, terms, matchCase);
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${escaped.join("|")})`, matchCase ? "g" : "gi");
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

export function NotePreview({ note }: { note: string }) {
  const value = readableNote(note);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const keepOpen = () => clearTimeout(dismissTimer.current);
  const dismiss = () => {
    keepOpen();
    dismissTimer.current = setTimeout(() => setPosition(undefined), 150);
  };
  useEffect(() => () => clearTimeout(dismissTimer.current), []);
  const [truncated, setTruncated] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      setTruncated(element.scrollWidth > element.clientWidth);
      setPosition(undefined);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);
  useEffect(() => {
    if (!position) return;
    const close = (event?: Event) => {
      if (event?.target instanceof Element && event.target.closest(".history-note-preview-tooltip")) return;
      setPosition(undefined);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", key);
    };
  }, [position]);
  const reveal = () => {
    keepOpen();
    if (!truncated || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 368)),
      top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 248)),
    });
  };
  return (
    <>
      <span
        className="history-note-column history-truncated"
        ref={ref}
        tabIndex={truncated ? 0 : undefined}
        aria-describedby={position ? id : undefined}
        onMouseEnter={reveal}
        onFocus={reveal}
        onMouseLeave={dismiss}
        onBlur={dismiss}
      >
        {value || "—"}
      </span>
      {position &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            tabIndex={0}
            onMouseEnter={keepOpen}
            onFocus={keepOpen}
            onMouseLeave={dismiss}
            onBlur={dismiss}
            className="history-note-preview-tooltip"
            style={position}
          >
            {value}
          </div>,
          document.body,
        )}
    </>
  );
}
