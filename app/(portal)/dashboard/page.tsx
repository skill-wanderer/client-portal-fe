"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { FileList } from "@/components/dashboard/file-list";
import { ProjectList } from "@/components/dashboard/project-list";
import { TaskList } from "@/components/dashboard/task-list";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useAuth } from "@/hooks/use-auth";
import {
  ApiClientError,
  buildApiUrl,
  getApiClientErrorMessage,
} from "@/lib/api-client";
import { type DashboardData, getDashboardData } from "@/lib/portal-api";
import { getLastBackendResponseMetadata } from "@/lib/runtime-correlation";
import {
  isProvisioningApiError,
  redirectToLoginForApiError,
} from "@/lib/portal-runtime";

type DashboardViewState = "loading" | "ready" | "provisioning" | "error";

const DASHBOARD_API_PATH = "/api/v1/client/dashboard";

function DashboardLoadingState() {
  return (
    <Container className="py-6 sm:py-8">
      <section className="ui-surface rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Dashboard loading
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Fetching your live portal data
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The frontend is loading authenticated dashboard data with the active browser access token.
        </p>
      </section>
    </Container>
  );
}

function ProvisioningErrorState() {
  return (
    <Container className="py-6 sm:py-8">
      <section className="ui-surface rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
              Dashboard unavailable
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Account not provisioned
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-900/80">
              Your sign-in succeeded, but this portal account has not been mapped to an active client profile yet. Ask an administrator to provision portal access for this email address.
            </p>
          </div>
          <span className="self-start rounded-full border border-amber-300 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            403
          </span>
        </div>
      </section>
    </Container>
  );
}

function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Container className="py-6 sm:py-8">
      <section className="ui-surface rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-950 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">
              Dashboard unavailable
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              We could not load your dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-900/80">{message}</p>
          </div>
          <span className="self-start rounded-full border border-rose-300 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
            Fallback
          </span>
        </div>
        <div className="mt-6">
          <Button type="button" onClick={onRetry}>
            Retry dashboard
          </Button>
        </div>
      </section>
    </Container>
  );
}

function logDashboardLoadFailure(error: unknown) {
  const diagnosticRecord = {
    level: "error",
    message: "dashboard_data_load_failed",
    endpointPath: DASHBOARD_API_PATH,
    endpointUrl: buildApiUrl(DASHBOARD_API_PATH),
    lastBackendResponse: getLastBackendResponseMetadata(),
    error:
      error instanceof ApiClientError
        ? {
            name: error.name,
            message: error.message,
            status: error.status,
            code: error.code,
            failureCode: error.failureCode,
            runtimeBoundary: error.runtimeBoundary,
            correlationId: error.correlationId,
            requestId: error.requestId,
            deploymentId: error.deploymentId,
            contractVersion: error.contractVersion,
            recoveryHint: error.recoveryHint,
            retryable: error.retryable,
          }
        : error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : {
              name: "Error",
              message: String(error),
            },
  };

  console.error(JSON.stringify(diagnosticRecord));
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<DashboardViewState>("loading");

  const loadDashboard = useCallback(async () => {
    try {
      const response = await getDashboardData();
      setDashboardData(response);
      setLoadError(null);
      setViewState("ready");
    } catch (error) {
      if (redirectToLoginForApiError(error)) {
        return;
      }

      if (isProvisioningApiError(error)) {
        setLoadError(null);
        setViewState("provisioning");
        return;
      }

      logDashboardLoadFailure(error);

      setLoadError(
        getApiClientErrorMessage(
          error,
          "The dashboard service returned an unusable response for this request. Refresh the page after the service is available."
        )
      );
      setViewState("error");
    }
  }, []);

  function handleRetry() {
    setLoadError(null);
    setViewState("loading");
    void loadDashboard();
  }

  useEffect(() => {
    // The browser access token is only available on the client, so dashboard loading starts after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  if (viewState === "loading" && !dashboardData) {
    return <DashboardLoadingState />;
  }

  if (viewState === "provisioning") {
    return <ProvisioningErrorState />;
  }

  if (viewState === "error" || !dashboardData) {
    return (
      <DashboardErrorState
        message={
          loadError ??
          "The dashboard service returned an unusable response for this request. Refresh the page after the service is available."
        }
        onRetry={handleRetry}
      />
    );
  }

  return (
    <Container className="py-6 sm:py-8">
      <div className="space-y-8">
        <section className="ui-surface overflow-hidden rounded-4xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-950/3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200/80 bg-zinc-50/70 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/60 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              Client portal
            </p>
          </div>
          <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)] lg:items-end sm:px-6 sm:py-6">
            <div className="min-w-0">
              <h1 className="wrap-break-word text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
                Welcome back
              </h1>
              <p className="mt-4 max-w-2xl wrap-break-word text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Your portal data is loaded directly from the client APIs using the active OIDC browser session.
              </p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-[1.35rem] border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  Email
                </dt>
                <dd className="mt-2 truncate text-sm font-medium text-zinc-950 dark:text-zinc-100" title={user?.email ?? "Not available"}>
                  {user?.email ?? "Not available"}
                </dd>
              </div>
              <div className="rounded-[1.35rem] border border-zinc-200/80 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/80">
                <dt className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                  Role
                </dt>
                <dd className="mt-2 truncate text-sm font-medium uppercase text-zinc-950 dark:text-zinc-100" title={user?.role ?? "Unknown"}>
                  {user?.role ?? "Unknown"}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <DashboardSummary summary={dashboardData.summary} />

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
          <div className="space-y-8">
            <ProjectList projects={dashboardData.projects} />
            <TaskList tasks={dashboardData.tasks} />
          </div>
          <FileList files={dashboardData.files} />
        </div>
      </div>
    </Container>
  );
}
