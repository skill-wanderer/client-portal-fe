"use client";

import { useEffect } from "react";
import Image from "next/image";
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
      : "Continue with SSO";
  const resolvedMessage =
    getRuntimeFailureMessage(lastFailure, error ?? errorMessage ?? "") || null;

  return (
    <Container className="max-w-none! px-0! sm:px-0! lg:px-0!">
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.14),transparent_34%),radial-gradient(circle_at_bottom,rgba(255,217,61,0.08),transparent_38%),linear-gradient(180deg,#1a1a1a_0%,#0f0f0f_100%)] px-5 py-10 text-[#e0e0e0] sm:px-6 lg:px-8">
        <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:36px_36px]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,15,15,0.10),rgba(15,15,15,0.78))]" />

        <main className="relative z-10 flex w-full max-w-md flex-col items-center">
          <div className="ui-surface w-full rounded-2xl border border-[rgba(255,107,53,0.20)] bg-[rgba(255,255,255,0.05)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-9">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(255,107,53,0.22)] bg-[rgba(255,255,255,0.06)] shadow-[0_14px_36px_rgba(255,107,53,0.18)]">
                <Image
                  src="/skill-wanderer-favicon.svg"
                  alt="Skill Wanderer"
                  width={44}
                  height={44}
                  priority
                  className="h-11 w-11 rounded-xl object-contain"
                />
              </div>

              <div className="mt-7 space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Sign in
                </h1>
                <p className="mx-auto max-w-xs text-sm leading-6 text-zinc-300/80">
                  Access your client portal securely using Single Sign-On.
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {resolvedMessage ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-lg border border-red-400/30 bg-red-950/45 p-4 text-sm leading-6 text-red-100"
                >
                  <svg
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-red-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 8V12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M12 16H12.01"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <p>{resolvedMessage}</p>
                </div>
              ) : null}

              {!isLoading && (hasErrorParam || error) ? (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-lg border border-amber-300/30 bg-amber-950/40 p-4 text-sm leading-6 text-amber-100"
                >
                  <svg
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-amber-200"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 9V13"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M12 16H12.01"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10.29 3.86L1.82 18A2 2 0 003.53 21H20.47A2 2 0 0022.18 18L13.71 3.86A2 2 0 0010.29 3.86Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p>
                    We could not restore a valid browser session automatically. Start a fresh Keycloak sign-in to continue.
                  </p>
                </div>
              ) : null}

              <Button
                className="h-14 w-full rounded-full bg-[linear-gradient(135deg,#FF6B35,#E85D25)] text-base font-semibold text-white shadow-[0_12px_34px_rgba(255,107,53,0.28)] hover:bg-[linear-gradient(135deg,#ff7a47,#FF6B35)] focus-visible:outline-[#FF6B35]"
                type="button"
                onClick={primaryAction}
                disabled={isLoading}
              >
                {primaryLabel}
              </Button>

              {lastFailure ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300/75">
                  <p className="font-medium uppercase tracking-[0.18em] text-zinc-400">
                    Runtime Status
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="font-mono text-xs text-zinc-200">
                      {lastFailure.failureCode}
                    </p>
                    <p className="font-mono text-xs text-zinc-400">
                      {lastFailure.runtimeBoundary}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-center text-xs text-zinc-400">
                Protected by Single Sign-On authentication.
              </p>
            </div>
          </div>
        </main>
      </div>
    </Container>
  );
}
