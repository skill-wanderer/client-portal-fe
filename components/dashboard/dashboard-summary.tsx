interface DashboardSummaryProps {
  summary: {
    activeProjects: number;
    pendingActions: number;
    unreadMessages: number;
    recentFiles: number;
  };
}

const summaryCards = [
  {
    key: "activeProjects",
    label: "Active projects",
    accent: "from-sky-500/15 to-sky-500/5 text-sky-700 dark:text-sky-300",
  },
  {
    key: "pendingActions",
    label: "Pending tasks",
    accent: "from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300",
  },
  {
    key: "unreadMessages",
    label: "Unread messages",
    accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-300",
  },
  {
    key: "recentFiles",
    label: "Recent files",
    accent: "from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-700 dark:text-fuchsia-300",
  },
] as const;

export function DashboardSummary({ summary }: DashboardSummaryProps) {
  return (
    <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {summaryCards.map((card) => (
        <article
          key={card.key}
          className={`rounded-3xl border border-zinc-200 bg-gradient-to-br p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${card.accent}`}
        >
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {card.label}
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {summary[card.key]}
          </p>
        </article>
      ))}
    </section>
  );
}