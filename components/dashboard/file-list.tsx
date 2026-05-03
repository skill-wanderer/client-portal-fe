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

export function FileList({ files }: FileListProps) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
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
              className="rounded-2xl border border-zinc-100 p-4 dark:border-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {file.fileName}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {file.category.replaceAll("_", " ")}
                  </p>
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