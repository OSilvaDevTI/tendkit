/**
 * Tendkit's mark: a speech bubble with a check cut out. One color (currentColor), like shadcn's own
 * mark, so it sits in any theme. The same shape is Tendkit's logo in the shadcn registry directory.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={className} fill="currentColor">
      <path
        fillRule="evenodd"
        d="M24 16H72A12 12 0 0 1 84 28V58A12 12 0 0 1 72 70H46L28 84V70H24A12 12 0 0 1 12 58V28A12 12 0 0 1 24 16ZM31 43L37 37L44 44L59 29L65 35L44 56Z"
      />
    </svg>
  );
}
