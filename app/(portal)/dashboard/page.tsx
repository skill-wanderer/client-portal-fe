// app/(portal)/dashboard/page.tsx

import { Container } from "@/components/ui/container";

export default function DashboardPage() {
  return (
    <Container className="py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        Dashboard
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Welcome to the client portal.
      </p>
    </Container>
  );
}
