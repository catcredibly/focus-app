/** Decorative, accent-aware leaf. Static platform icons are separate assets. */
export function FocusLeaf({ className = "" }: { className?: string }) {
  return <span className={`focus-leaf ${className}`} aria-hidden="true" />;
}
