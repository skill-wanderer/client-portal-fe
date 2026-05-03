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
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Tasks
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Pending actions
          </h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{tasks.length} open item(s)</p>
      </div>

      <div className="mt-6 space-y-4">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            You have no pending tasks right now.
          </div>
        ) : (
          tasks.map((task) => (
            <article
              key={task.id}
              className="rounded-2xl border border-zinc-100 p-5 dark:border-zinc-900"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {task.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {task.description}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  {task.status.replaceAll("_", " ")}
                </span>
              </div>

              <dl className="mt-5 grid gap-3 text-sm text-zinc-500 dark:text-zinc-400 md:grid-cols-2">
                <div>
                  <dt className="font-medium">Due date</dt>
                  <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDueDate(task.dueDate)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Project reference</dt>
                  <dd className="mt-1 break-all text-zinc-900 dark:text-zinc-100">{task.projectId}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}