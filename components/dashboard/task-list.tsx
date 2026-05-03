import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

interface TaskListProps {
  tasks: Array<{
    id: string;
    projectId: string;
    title: string;
    description: string;
    status: string;
    dueDate: string | null;
  }>;
}

function formatDueDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function TaskList({ tasks }: TaskListProps) {
  return (
    <section className="ui-surface overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-950/3 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Tasks
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Pending actions
          </h2>
        </div>
        <p className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{tasks.length} open item(s)</p>
      </div>

      <div className="mt-6 space-y-4">
        {tasks.length === 0 ? (
          <EmptyState
            eyebrow="Tasks"
            title="Nothing needs attention"
            description="New client action items will show up here as soon as they are assigned to your account."
          />
        ) : (
          tasks.map((task) => (
            <article
              key={task.id}
              className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-5 transition-transform duration-200 hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-900/60"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {task.title}
                  </h3>
                  <p className="ui-line-clamp-3 mt-2 break-words text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {task.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <span className="inline-flex w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                    {task.status.replaceAll("_", " ")}
                  </span>
                  <span className="inline-flex w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                    Due {formatDueDate(task.dueDate)}
                  </span>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 text-sm text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Due date</dt>
                  <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDueDate(task.dueDate)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="font-medium">Project reference</dt>
                  <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                    <Link
                      href={`/projects/${task.projectId}`}
                      className="block max-w-full truncate transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                      title={task.projectId}
                    >
                      {task.projectId}
                    </Link>
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}