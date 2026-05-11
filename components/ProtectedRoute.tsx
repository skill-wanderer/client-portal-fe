"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useAuth } from "@/hooks/use-auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { error, isAuthenticated, isLoading, login, refreshUser } = useAuth();

  useEffect(() => {
    if (!isLoading && !error && !isAuthenticated) {
      router.replace("/login");
    }
  }, [error, isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <Container className="py-12 sm:py-16">
        <section className="ui-surface rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Checking session
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Loading your portal session
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            We are verifying your backend session before rendering protected content.
          </p>
        </section>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-12 sm:py-16">
        <section className="ui-surface rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-950 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">
            Session unavailable
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            We could not verify your session
          </h1>
          <p className="mt-3 text-sm leading-6 text-rose-900/80">{error}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" onClick={() => void refreshUser()}>
              Try again
            </Button>
            <Button type="button" variant="secondary" onClick={login}>
              Go to login
            </Button>
          </div>
        </section>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}