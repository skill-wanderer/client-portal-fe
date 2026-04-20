// components/navigation.tsx
import Link from "next/link";
import { Container } from "@/components/ui/container";

export function Navigation() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <Container>
        <nav className="flex h-14 items-center justify-between">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Client Portal
          </Link>
          <div className="flex items-center gap-4">
            {/* Future: user menu, notifications */}
          </div>
        </nav>
      </Container>
    </header>
  );
}
