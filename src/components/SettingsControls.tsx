import type { ReactNode } from "react";

export function Row({ label, hint, children, disabled = false }: { label: string; hint?: string; children: ReactNode; disabled?: boolean }) { return <div className={`setting-row ${disabled ? "setting-row--disabled" : ""}`}><div><strong>{label}</strong>{hint && <span>{hint}</span>}</div><fieldset className="setting-control" disabled={disabled}>{children}</fieldset></div>; }
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) { return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`settings-toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><span/></button>; }
