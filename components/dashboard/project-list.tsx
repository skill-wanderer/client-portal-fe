import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

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
    <section className="ui-surface overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-950/3 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Projects
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Active work
          </h2>
        </div>
        <p className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{projects.length} project(s)</p>
      </div>

      <div className="mt-6 space-y-4">
        {projects.length === 0 ? (
          <EmptyState
            eyebrow="Projects"
            title="No projects yet"
            description="Projects assigned to this client account will appear here as soon as they are provisioned."
          />
        ) : (
          projects.map((project) => (
            <article
              key={project.id}
              className="group overflow-hidden rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-5 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    <Link
                      href={`/projects/${project.id}`}
                      className="block truncate transition-colors hover:text-zinc-600 group-hover:text-zinc-950 dark:hover:text-zinc-300 dark:group-hover:text-zinc-100"
                      title={project.name}
                    >
                      {project.name}
                    </Link>
                  </h3>
                  <p className="ui-line-clamp-3 mt-2 break-words text-sm leading-6 text-zinc-600 dark:text-zinc-400">
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

              <dl className="mt-5 grid gap-3 text-sm text-zinc-500 dark:text-zinc-400 sm:grid-cols-2 xl:grid-cols-3">
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