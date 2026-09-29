import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Use the chart tooltip surface outside scrollable tables so it cannot be clipped. */
export function ValueTooltip({ children, lines }: { children: ReactNode; lines: string[] }) {
  const id = useId();
  const host = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  const show = () => {
    const rect = host.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
        top: Math.max(8, Math.min(rect.bottom + 7, window.innerHeight - 108)),
      });
  };
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(undefined);
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
  return (
    <>
      <span
        ref={host}
        tabIndex={0}
        className="summary-tooltip-value"
        aria-describedby={position ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={() => setPosition(undefined)}
        onFocus={show}
        onBlur={() => setPosition(undefined)}
      >
        {children}
      </span>
      {position &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="chart-tooltip"
            style={{
              ...position,
              position: "fixed",
              zIndex: 1000,
              maxWidth: "min(320px, calc(100vw - 16px))",
              pointerEvents: "none",
            }}
          >
            {lines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
