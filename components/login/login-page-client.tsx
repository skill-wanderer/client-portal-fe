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
    <Container className="flex flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Sign in
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to access the client portal.
          </p>
        </div>
        {resolvedMessage && (
          <div className="rounded-md bg-red-50 p-3 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {resolvedMessage}
          </div>
        )}
        <Button className="w-full" type="button" onClick={primaryAction}>
          {primaryLabel}
        </Button>
        {!isLoading && (hasErrorParam || error) ? (
          <div className="rounded-md bg-amber-50 p-3 text-center text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            We could not restore a valid browser session automatically. Start a fresh Keycloak sign-in to continue.
          </div>
        ) : null}
        {lastFailure ? (
          <p className="text-center text-xs uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {lastFailure.failureCode} • {lastFailure.runtimeBoundary}
          </p>
        ) : null}
      </div>
    </Container>
  );
}