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
    <Container className="max-w-none! px-0! sm:px-0! lg:px-0!">
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
          <section className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:items-center lg:justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.30),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.92),transparent_38%)]" />
            <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-slate-900 to-slate-950" />
            <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative z-10 mx-auto w-full max-w-2xl px-12 py-16 xl:px-16">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-100">
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 4L19 8V16L12 20L5 16V8L12 4Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 9V15"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9.5 11.5L12 9L14.5 11.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Skill Wanderer
              </div>

              <div className="mt-10 space-y-6">
                <p className="text-sm uppercase tracking-[0.32em] text-indigo-200/80">
                  Secure Client Access
                </p>
                <h2 className="max-w-xl text-4xl font-semibold tracking-tight text-white xl:text-5xl">
                  Access projects, documents, and delivery updates in one secure client portal.
                </h2>
                <p className="max-w-lg text-base leading-7 text-slate-300">
                  A private workspace for clients to access shared files, follow delivery progress, and collaborate securely with the Skill Wanderer team.
                </p>
              </div>

              <div className="mt-12 overflow-hidden rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                  <span className="h-3 w-3 rounded-full bg-white/20" />
                  <span className="h-3 w-3 rounded-full bg-white/20" />
                  <span className="h-3 w-3 rounded-full bg-white/20" />
                </div>

                <div className="mt-5 grid gap-4">
                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                            Project Space
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            Delivery Workspace
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
                          On Track
                        </span>
                      </div>
                      <div className="mt-5 space-y-3">
                        <div className="h-3 w-5/6 rounded-full bg-slate-700" />
                        <div className="h-3 w-3/4 rounded-full bg-slate-800" />
                        <div className="h-3 w-2/3 rounded-full bg-slate-800" />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Shared Documents
                      </p>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-xl bg-white/8 px-3 py-3">
                          <div className="h-2.5 w-16 rounded-full bg-indigo-300/80" />
                          <div className="mt-2 h-2.5 w-20 rounded-full bg-slate-600" />
                        </div>
                        <div className="rounded-xl bg-white/8 px-3 py-3">
                          <div className="h-2.5 w-12 rounded-full bg-sky-300/80" />
                          <div className="mt-2 h-2.5 w-24 rounded-full bg-slate-600" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Documents
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white">24</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Milestones
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white">08</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Messages
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white">17</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="relative flex items-center justify-center overflow-hidden px-6 py-12 sm:px-10 lg:px-16">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_30%)]" />
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-indigo-100 blur-3xl" />

            <div className="relative z-10 w-full max-w-md">
              <div className="mb-8 text-center lg:hidden">
                <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 4L19 8V16L12 20L5 16V8L12 4Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 9V15"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M9.5 11.5L12 9L14.5 11.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  Client Portal
                </div>
              </div>

              <div className="ui-surface space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
                <div className="space-y-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/15">
                    <svg
                      aria-hidden="true"
                      className="h-6 w-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 4L19 8V16L12 20L5 16V8L12 4Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 8.5V15.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M9.5 11.5L12 9L14.5 11.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div className="space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                      Sign in
                    </h1>
                    <p className="text-sm leading-6 text-slate-500">
                      Sign in to access the client portal.
                    </p>
                  </div>
                </div>

                {resolvedMessage ? (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    <svg
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0"
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
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <svg
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0"
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
                  className="h-12 w-full text-base font-medium shadow-lg shadow-slate-900/10"
                  type="button"
                  onClick={primaryAction}
                  disabled={isLoading}
                >
                  {primaryLabel}
                </Button>

                {lastFailure ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-100/70 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="font-medium uppercase tracking-[0.18em] text-slate-500">
                      Runtime Status
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="font-mono text-xs text-slate-700">
                        {lastFailure.failureCode}
                      </p>
                      <p className="font-mono text-xs text-slate-700">
                        {lastFailure.runtimeBoundary}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-slate-200 pt-4">
                  <p className="text-center text-xs text-slate-500">
                    Protected by Keycloak authentication.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Container>
  );
}