import type { ButtonHTMLAttributes, ReactNode } from "react";

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <span className="tooltip-host">
      <button {...props} className={className} aria-label={label}>
        {children}
      </button>
      <span className="focus-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}
