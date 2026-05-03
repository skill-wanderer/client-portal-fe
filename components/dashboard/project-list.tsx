import Link from "next/link";

interface ProjectListProps {
  projects: Array<{
    id: string;
    name: string;
    summary: string;
    status: string;
    startDate: string | null;
    targetDate: string | null;
    lastUpdatedAt: string;
  }>;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Projects
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Active work
          </h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{projects.length} project(s)</p>
      </div>

      <div className="mt-6 space-y-4">
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No projects are assigned to this client account yet.
          </div>
        ) : (
          projects.map((project) => (
            <article
              key={project.id}
              className="rounded-2xl border border-zinc-100 p-5 dark:border-zinc-900"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    <Link
                      href={`/projects/${project.id}`}
                      className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {project.name}
                    </Link>
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {project.summary}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <span className="inline-flex w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    {project.status.replaceAll("_", " ")}
                  </span>
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-100"
                  >
                    Open project
                  </Link>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 text-sm text-zinc-500 dark:text-zinc-400 md:grid-cols-3">
                <div>
                  <dt className="font-medium">Start date</dt>
                  <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDate(project.startDate)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Target date</dt>
                  <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDate(project.targetDate)}</dd>
                </div>
                <div>
                  <dt className="font-medium">Last updated</dt>
                  <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatDate(project.lastUpdatedAt)}</dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}