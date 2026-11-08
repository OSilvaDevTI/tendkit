/** Tendkit's mark: a speech bubble with a check, in the brand color. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect width="24" height="24" rx="6" className="fill-primary" />
      <path
        d="M7 7.5h10a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 17 16h-5.2L9 18.3V16H7a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 7 7.5Z"
        className="fill-primary-foreground"
      />
      <path d="m9.6 11.6 1.6 1.6 3.3-3.3" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" />
    </svg>
  );
}
