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
    <section className="rounded-[1.75rem] border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-950/3 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          Files
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Recent uploads
        </h2>
      </div>

      <div className="mt-6 space-y-4">
        {files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-10 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No files are available yet for this account.
          </div>
        ) : (
          files.map((file) => (
            <article
              key={file.id}
              className="rounded-3xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                    <FileIcon />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {file.fileName}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      {file.category.replaceAll("_", " ")}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  {formatCreatedAt(file.createdAt)}
                </span>
              </div>

              <p className="mt-4 break-all text-xs text-zinc-500 dark:text-zinc-400">
                Project ID: {file.projectId}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}