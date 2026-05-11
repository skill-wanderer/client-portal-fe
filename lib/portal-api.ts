import { apiFetch, apiMutation } from "@/lib/api-client";

export interface DashboardSummaryData {
  activeProjects: number;
  pendingActions: number;
  unreadMessages: number;
  recentFiles: number;
}

export interface DashboardProject {
  id: string;
  name: string;
  summary: string;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  lastUpdatedAt: string;
}

export interface DashboardTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
}

export interface DashboardFile {
  id: string;
  projectId: string;
  fileName: string;
  category: string;
  createdAt: string;
}

export interface DashboardData {
  summary: DashboardSummaryData;
  projects: DashboardProject[];
  tasks: DashboardTask[];
  files: DashboardFile[];
}

export interface ProjectDetail {
  id: string;
  name: string;
  summary: string;
  status: string;
  startDate: string | null;
  targetDate: string | null;
  lastUpdatedAt: string;
}

export interface ProjectTask {
  id: string;
  assignedUserId: string;
  title: string;
  description: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
}

export interface ProjectMessage {
  id: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface ProjectFile {
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
  messages?: ProjectMessage[];
}

interface ProjectFilesResponse {
  files: ProjectFile[];
}

interface ProjectMessagesResponse {
  messages: ProjectMessage[];
}

export interface ProjectPageData {
  project: ProjectDetail;
  tasks: ProjectTask[];
  messages: ProjectMessage[];
  files: ProjectFile[];
}

export function getDashboardData() {
  return apiFetch<DashboardData>("/api/v1/client/dashboard", {
    cache: "no-store",
  });
}

export async function getProjectPageData(projectId: string) {
  const [projectResponse, filesResponse, messagesResponse] = await Promise.all([
    apiFetch<ProjectDetailResponse>(`/api/v1/client/projects/${projectId}`, {
      cache: "no-store",
    }),
    apiFetch<ProjectFilesResponse>(
      `/api/v1/client/projects/${projectId}/files`,
      {
        cache: "no-store",
      }
    ),
    apiFetch<ProjectMessagesResponse>(
      `/api/v1/client/projects/${projectId}/messages`,
      {
        cache: "no-store",
      }
    ),
  ]);

  return {
    project: projectResponse.project,
    tasks: projectResponse.tasks,
    messages: messagesResponse.messages ?? projectResponse.messages ?? [],
    files: filesResponse.files,
  } satisfies ProjectPageData;
}

export function completeProjectTask(taskId: string) {
  return apiMutation<{ task: ProjectTask }>(
    `/api/v1/client/tasks/${taskId}/complete`,
    {
      method: "POST",
    }
  );
}

export function sendProjectMessage(projectId: string, body: string) {
  return apiMutation<{ message: ProjectMessage }>(
    `/api/v1/client/projects/${projectId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    }
  );
}