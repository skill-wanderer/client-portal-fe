"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import {
  completeOidcSigninCallback,
  getPostLoginRedirectPath,
} from "@/lib/oidc";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const user = await completeOidcSigninCallback();

        if (!isActive) {
          return;
        }

        router.replace(getPostLoginRedirectPath(user));
      } catch (cause) {
        const message =
          cause instanceof Error && cause.message.trim() !== ""
            ? cause.message
            : "Authentication failed.";

        if (!isActive) {
          return;
        }

        setError(message);
        router.replace(`/login?error=${encodeURIComponent("auth_failed")}`);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [router]);

  return (
    <Container className="flex flex-1 items-center justify-center py-12 sm:py-16">
      <section className="ui-surface w-full max-w-lg rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Completing sign-in
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Restoring your client portal session
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The portal is exchanging the Keycloak authorization code for browser tokens and returning you to the requested page.
        </p>
        {error ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
      </section>
    </Container>
  );
}