import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { FileList } from "@/components/dashboard/file-list";
import { ProjectList } from "@/components/dashboard/project-list";
import { TaskList } from "@/components/dashboard/task-list";
import { Container } from "@/components/ui/container";
import { env } from "@/lib/env";

interface DashboardUser {
  id: string;
  role: string;
  displayName: string;
  email: string;
  companyName: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardSummaryData {
  activeProjects: number;
  pendingActions: number;
  unreadMessages: number;
  recentFiles: number;
}

interface DashboardProject {
  id: string;
  name: string;
  summary: string;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  lastUpdatedAt: string;
}

interface DashboardTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
}

interface DashboardFile {
  id: string;
  projectId: string;
  fileName: string;
  category: string;
  createdAt: string;
}

interface DashboardResponse {
  user: DashboardUser;
  summary: DashboardSummaryData;
  projects: DashboardProject[];
  tasks: DashboardTask[];
  files: DashboardFile[];
}

function getDashboardOrigin(host: string | null, protocol: string | null) {
  if (!host) {
    return env.appUrl;
  }

  const resolvedProtocol = protocol ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : new URL(env.appUrl).protocol.replace(":", ""));

  return `${resolvedProtocol}://${host}`;
}

async function fetchDashboardData() {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const origin = getDashboardOrigin(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    headerStore.get("x-forwarded-proto")
  );

  return fetch(`${origin}/api/dashboard`, {
    cache: "no-store",
    headers: {
      cookie: cookieStore.toString(),
    },
  });
}

function ProvisioningErrorState() {
  return (
    <Container className="py-8">
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Dashboard unavailable
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

function DashboardErrorState() {
  return (
    <Container className="py-8">
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-950 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">
          Dashboard unavailable
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          We could not load your dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-900/80">
          The live dashboard API did not return usable data for this request. Refresh the page after the service is available.
        </p>
      </section>
    </Container>
  );
}

export default async function DashboardPage() {
  let response: Response;

  try {
    response = await fetchDashboardData();
  } catch {
    return <DashboardErrorState />;
  }

  if (response.status === 401) {
    redirect("/login");
  }

  if (response.status === 403) {
    return <ProvisioningErrorState />;
  }

  if (!response.ok) {
    return <DashboardErrorState />;
  }

  let dashboardData: DashboardResponse;

  try {
    dashboardData = (await response.json()) as DashboardResponse;
  } catch {
    return <DashboardErrorState />;
  }

  return (
    <Container className="py-8">
      <section className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Client portal
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Welcome back, {dashboardData.user.displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              This dashboard is backed by the live session-scoped API and shows your active projects, pending tasks, and recent files.
            </p>
          </div>
          <dl className="grid gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <div>
              <dt className="font-medium text-zinc-500 dark:text-zinc-500">Email</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{dashboardData.user.email}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500 dark:text-zinc-500">Company</dt>
              <dd className="mt-1 text-zinc-900 dark:text-zinc-100">
                {dashboardData.user.companyName ?? "Not available"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <DashboardSummary summary={dashboardData.summary} />

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)]">
        <div className="space-y-8">
          <ProjectList projects={dashboardData.projects} />
          <TaskList tasks={dashboardData.tasks} />
        </div>
        <FileList files={dashboardData.files} />
      </div>
    </Container>
  );
}
