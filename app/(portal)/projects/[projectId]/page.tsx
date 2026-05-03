import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProjectDetailClient } from "@/components/project-detail/project-detail-client";
import { Container } from "@/components/ui/container";
import { env } from "@/lib/env";

interface ProjectDetail {
  id: string;
  name: string;
  summary: string;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  lastUpdatedAt: string;
}

interface ProjectTask {
  id: string;
  assignedUserId: string;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
}

interface ProjectMessage {
  id: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

interface ProjectFile {
  id: string;
  uploadedByUserId: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  createdAt: string;
}

interface ProjectDetailResponse {
  project: ProjectDetail;
  tasks: ProjectTask[];
  messages: ProjectMessage[];
}

interface ProjectFilesResponse {
  files: ProjectFile[];
}

function getRequestOrigin(host: string | null, protocol: string | null) {
  if (!host) {
    return env.appUrl;
  }

  const resolvedProtocol =
    protocol ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : new URL(env.appUrl).protocol.replace(":", ""));

  return `${resolvedProtocol}://${host}`;
}

async function fetchProjectResources(projectId: string) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const origin = getRequestOrigin(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    headerStore.get("x-forwarded-proto")
  );
  const requestHeaders = {
    cookie: cookieStore.toString(),
  };

  return Promise.all([
    fetch(`${origin}/api/projects/${projectId}`, {
      cache: "no-store",
      headers: requestHeaders,
    }),
    fetch(`${origin}/api/projects/${projectId}/files`, {
      cache: "no-store",
      headers: requestHeaders,
    }),
  ]);
}

function ProvisioningErrorState() {
  return (
    <Container className="py-8">
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Project unavailable
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Account not provisioned
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-900/80">
          Your sign-in succeeded, but this portal account has not been mapped to an active client profile yet.
        </p>
      </section>
    </Container>
  );
}

function ProjectNotFoundState() {
  return (
    <Container className="py-8">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Project unavailable
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Project not found
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          This project does not exist for the current session or is no longer available to your account.
        </p>
      </section>
    </Container>
  );
}

function ProjectErrorState() {
  return (
    <Container className="py-8">
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-950 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">
          Project unavailable
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          We could not load this project
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-900/80">
          The live project APIs did not return usable data for this request. Refresh the page after the service is available.
        </p>
      </section>
    </Container>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  let projectResponse: Response;
  let filesResponse: Response;

  try {
    [projectResponse, filesResponse] = await fetchProjectResources(projectId);
  } catch {
    return <ProjectErrorState />;
  }

  if (projectResponse.status === 401) {
    redirect("/login");
  }

  if (projectResponse.status === 403) {
    return <ProvisioningErrorState />;
  }

  if (projectResponse.status === 404) {
    return <ProjectNotFoundState />;
  }

  if (!projectResponse.ok || !filesResponse.ok) {
    return <ProjectErrorState />;
  }

  let projectData: ProjectDetailResponse;
  let filesData: ProjectFilesResponse;

  try {
    projectData = (await projectResponse.json()) as ProjectDetailResponse;
    filesData = (await filesResponse.json()) as ProjectFilesResponse;
  } catch {
    return <ProjectErrorState />;
  }

  return (
    <Container className="py-8">
      <ProjectDetailClient
        project={projectData.project}
        tasks={projectData.tasks}
        messages={projectData.messages}
        files={filesData.files}
      />
    </Container>
  );
}