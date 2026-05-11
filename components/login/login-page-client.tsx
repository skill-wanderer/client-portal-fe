"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useAuth } from "@/hooks/use-auth";

interface LoginPageClientProps {
  errorMessage: string | null;
  hasErrorParam: boolean;
}

export function LoginPageClient({
  errorMessage,
  hasErrorParam,
}: LoginPageClientProps) {
  const router = useRouter();
  const { error, isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

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
        {errorMessage && (
          <div className="rounded-md bg-red-50 p-3 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errorMessage}
          </div>
        )}
        <Button className="w-full" type="button" onClick={login}>
          {isLoading ? "Checking session..." : "Continue with SSO"}
        </Button>
        {!isLoading && (hasErrorParam || error) ? (
          <div className="rounded-md bg-amber-50 p-3 text-center text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            We could not confirm your current session. You can still continue to the backend login flow.
          </div>
        ) : null}
      </div>
    </Container>
  );
}