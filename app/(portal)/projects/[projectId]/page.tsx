"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProjectDetailClient } from "@/components/project-detail/project-detail-client";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ApiClientError } from "@/lib/api-client";
import {
  getProjectPageData,
  type ProjectPageData,
} from "@/lib/portal-api";

type ProjectViewState =
  | "loading"
  | "ready"
  | "provisioning"
  | "not-found"
  | "error";

function ProjectLoadingState() {
  return (
    <Container className="py-6 sm:py-8">
      <section className="ui-surface rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Project loading
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Fetching project details
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The frontend is loading project data directly from the backend client API.
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
              Project unavailable
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

function ProjectNotFoundState() {
  return (
    <Container className="py-6 sm:py-8">
      <section className="ui-surface rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Project unavailable
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Project not found
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              This project does not exist for the current session or is no longer available to your account.
            </p>
            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
            >
              Return to dashboard
            </Link>
          </div>
          <span className="self-start rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            404
          </span>
        </div>
      </section>
    </Container>
  );
}

function ProjectErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Container className="py-6 sm:py-8">
      <section className="ui-surface rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-950 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">
              Project unavailable
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              We could not load this project
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-900/80">
              The live project APIs did not return usable data for this request. Refresh the page after the service is available.
            </p>
            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center rounded-full border border-rose-300 bg-white/70 px-4 py-2 text-sm font-medium text-rose-700 transition-colors hover:border-rose-400 hover:text-rose-900"
            >
              Return to dashboard
            </Link>
          </div>
          <span className="self-start rounded-full border border-rose-300 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
            Fallback
          </span>
        </div>
        <div className="mt-6">
          <Button type="button" onClick={onRetry}>
            Retry project
          </Button>
        </div>
      </section>
    </Container>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string | string[] }>();
  const rawProjectId = params.projectId;
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  const [projectData, setProjectData] = useState<ProjectPageData | null>(null);
  const [viewState, setViewState] = useState<ProjectViewState>("loading");

  const loadProject = useCallback(async () => {
    if (!projectId) {
      setViewState("error");
      return;
    }

    try {
      const response = await getProjectPageData(projectId);
      setProjectData(response);
      setViewState("ready");
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          window.location.assign("/login");
          return;
        }

        if (error.status === 403) {
          setViewState("provisioning");
          return;
        }

        if (error.status === 404) {
          setViewState("not-found");
          return;
        }
      }

      setViewState("error");
    }
  }, [projectId]);

  function handleRetry() {
    setViewState("loading");
    void loadProject();
  }

  useEffect(() => {
    // The project view must start its authenticated backend fetch in the browser because the FE host never receives the API cookie.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProject();
  }, [loadProject]);

  if (viewState === "loading" && !projectData) {
    return <ProjectLoadingState />;
  }

  if (viewState === "provisioning") {
    return <ProvisioningErrorState />;
  }

  if (viewState === "not-found") {
    return <ProjectNotFoundState />;
  }

  if (viewState === "error" || !projectData || !projectId) {
    return <ProjectErrorState onRetry={handleRetry} />;
  }

  return (
    <Container className="py-6 sm:py-8">
      <ProjectDetailClient
        key={projectId}
        project={projectData.project}
        tasks={projectData.tasks}
        messages={projectData.messages}
        files={projectData.files}
      />
    </Container>
  );
}