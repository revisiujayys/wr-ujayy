export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`select-none inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8 text-brand" aria-hidden="true">
        <path d="M4 16h24a12 12 0 0 1-24 0z" fill="currentColor" />
        <path
          d="M11 6c0 2 2 2 2 5M17 5c0 2 2 2 2 5M23 6c0 2 2 2 2 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="text-lg font-bold tracking-tight">Wr. Ujayy</span>
    </span>
  );
}
