"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useAuth } from "@/hooks/use-auth";

export function Navigation() {
  const { isLoading, logout, user } = useAuth();

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
          <div className="flex items-center gap-3">
            {user?.email ? (
              <span className="hidden max-w-56 truncate text-sm text-zinc-500 dark:text-zinc-400 sm:block">
                {user.email}
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={logout}
              disabled={isLoading}
            >
              Sign out
            </Button>
          </div>
        </nav>
      </Container>
    </header>
  );
}
