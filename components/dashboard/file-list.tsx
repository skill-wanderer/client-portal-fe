import { EmptyState } from "@/components/ui/empty-state";

interface FileListProps {
  files: Array<{
    id: string;
    projectId: string;
    fileName: string;
    category: string;
    createdAt: string;
  }>;
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function FileIcon() {
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
      <path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5L14 3.5Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M8.5 12.5h7" />
      <path d="M8.5 16h5" />
    </svg>
  );
}

export function FileList({ files }: FileListProps) {
  return (
    <section className="ui-surface overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-950/3 sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Files
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Recent uploads
          </h2>
        </div>
        <p className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{files.length} file(s)</p>
      </div>

      <div className="mt-6 space-y-4">
        {files.length === 0 ? (
          <EmptyState
            eyebrow="Files"
            title="No recent files"
            description="Shared deliverables and client uploads will appear here once they are added to your projects."
          />
        ) : (
          files.map((file) => (
            <article
              key={file.id}
              className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-4 transition-transform duration-200 hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-900/60"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                    <FileIcon />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={file.fileName}>
                      {file.fileName}
                    </h3>
                    <p className="mt-2 break-words text-sm text-zinc-500 dark:text-zinc-400">
                      {file.category.replaceAll("_", " ")}
                    </p>
                  </div>
                </div>
                <span className="self-start rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  {formatCreatedAt(file.createdAt)}
                </span>
              </div>

              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Project ID</span>
                <span className="mt-1 block truncate" title={file.projectId}>
                  {file.projectId}
                </span>
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}