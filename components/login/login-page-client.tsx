"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useAuth } from "@/hooks/use-auth";
import {
  getRuntimeFailureMessage,
  isRecoverableAuthFailure,
} from "@/lib/runtime-failures";

interface LoginPageClientProps {
  errorMessage: string | null;
  hasErrorParam: boolean;
}

export function LoginPageClient({
  errorMessage,
  hasErrorParam,
}: LoginPageClientProps) {
  const router = useRouter();
  const { error, isAuthenticated, isLoading, lastFailure, login, recoverSession } =
    useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const primaryAction =
    lastFailure && isRecoverableAuthFailure(lastFailure)
      ? recoverSession
      : login;
  const primaryLabel = isLoading
    ? "Checking sign-in state..."
    : lastFailure && isRecoverableAuthFailure(lastFailure)
      ? "Resume sign-in"
      : "Continue with Keycloak";
  const resolvedMessage =
    getRuntimeFailureMessage(lastFailure, error ?? errorMessage ?? "") || null;

  return (
    <Container className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 p-8 space-y-6">
          {/* ── Heading ── */}
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Sign in
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to access the client portal.
            </p>
          </div>

          {/* ── Error alert ── */}
          {resolvedMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {resolvedMessage}
            </div>
          )}

          {/* ── Session warning ── */}
          {!isLoading && (hasErrorParam || error) ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              We could not restore a valid browser session automatically. Start
              a fresh Keycloak sign-in to continue.
            </div>
          ) : null}

          {/* ── CTA button ── */}
          <Button
            className="w-full py-3 text-base"
            type="button"
            onClick={primaryAction}
          >
            {primaryLabel}
          </Button>

          {/* ── Runtime status panel ── */}
          {lastFailure ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Runtime Status
              </p>
              <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {lastFailure.failureCode}
              </p>
              <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {lastFailure.runtimeBoundary}
              </p>
            </div>
          ) : null}
        </div>

        {/* ── Footer ── */}
        <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Protected by Keycloak authentication.
        </p>
      </div>
    </Container>
  );
}