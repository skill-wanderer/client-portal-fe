import { Container } from "@/components/ui/container";

export default function Loading() {
  return (
    <Container className="py-8">
      <div className="space-y-8">
        <section className="overflow-hidden rounded-4xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-950/3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="h-12 border-b border-zinc-200/80 bg-zinc-100/80 dark:border-zinc-800 dark:bg-zinc-900/80" />
          <div className="grid min-h-61 gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)] animate-pulse">
            <div>
              <div className="h-10 max-w-md rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-4 h-4 max-w-2xl rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-2 h-4 max-w-xl rounded-full bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[1.35rem] border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80"
                >
                  <div className="h-3 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-3 h-4 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="min-h-40 rounded-[1.75rem] border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-950/3 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="h-3 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-6 h-12 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-3 h-3 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </section>

        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
          <div className="space-y-8">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="min-h-82.5 rounded-[1.75rem] border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-950/3 dark:border-zinc-800 dark:bg-zinc-950 animate-pulse"
              >
                <div className="h-3 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="mt-3 h-8 w-44 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="mt-6 space-y-4">
                  {Array.from({ length: 3 }).map((__, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="rounded-3xl border border-zinc-100/80 bg-zinc-50/70 p-5 dark:border-zinc-900 dark:bg-zinc-900/60"
                    >
                      <div className="h-4 w-40 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="mt-3 h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="mt-2 h-3 w-3/4 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="mt-4 flex gap-2">
                        <div className="h-7 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                        <div className="h-7 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="min-h-167 rounded-[1.75rem] border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-950/3 dark:border-zinc-800 dark:bg-zinc-950 animate-pulse">
            <div className="h-3 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-3 h-8 w-36 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-6 space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-3xl border border-zinc-100/80 bg-zinc-50/70 p-4 dark:border-zinc-900 dark:bg-zinc-900/60"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                    <div className="flex-1">
                      <div className="h-4 w-40 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="mt-3 h-3 w-32 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Container>
  );
}