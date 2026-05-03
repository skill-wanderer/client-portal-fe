interface EmptyStateProps {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
}

function EmptyStateIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.5 7.5A2.5 2.5 0 0 1 8 5h8a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 16 19H8a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
      <path d="M8.5 10h7" />
      <path d="M8.5 14h4.5" />
    </svg>
  );
}

export function EmptyState({
  eyebrow,
  title,
  description,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`ui-surface rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/80 px-5 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50 ${className}`}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-white text-zinc-500 shadow-sm shadow-zinc-950/5 dark:bg-zinc-950 dark:text-zinc-300">
        <EmptyStateIcon />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}