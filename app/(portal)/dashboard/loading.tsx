import { Container } from "@/components/ui/container";

export default function Loading() {
  return (
    <Container className="py-8">
      <div className="space-y-8 animate-pulse">
        <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="h-4 w-32 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-4 h-10 max-w-md rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-4 h-4 max-w-2xl rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 max-w-xl rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="h-3 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-4 h-10 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </section>

        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
          <div className="space-y-8">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="h-8 w-44 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="mt-6 space-y-4">
                  {Array.from({ length: 3 }).map((__, rowIndex) => (
                    <div
                      key={rowIndex}
                      className="rounded-2xl border border-zinc-100 p-4 dark:border-zinc-900"
                    >
                      <div className="h-4 w-40 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="mt-3 h-3 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="mt-2 h-3 w-3/4 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="h-8 w-36 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-6 space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-zinc-100 p-4 dark:border-zinc-900"
                >
                  <div className="h-4 w-40 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-3 h-3 w-32 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Container>
  );
}