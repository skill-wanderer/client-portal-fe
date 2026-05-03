import { NextResponse } from "next/server";
import { getCurrentPortalAuthContext } from "@/lib/auth/portal-user";
import { query } from "@/lib/db";

interface DashboardProjectRow {
  id: string;
  name: string;
  summary: string;
  status: string;
  start_date: string | null;
  target_date: string | null;
  last_updated_at: string | Date;
}

interface DashboardTaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  due_date: string | Date | null;
}

interface CountRow {
  count: string;
}

interface RecentFileRow {
  id: string;
  project_id: string;
  file_name: string;
  category: string;
  created_at: string | Date;
}

export async function GET() {
  const authContext = await getCurrentPortalAuthContext();

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!authContext.portalUser) {
    return NextResponse.json({ error: "user_not_provisioned" }, { status: 403 });
  }

  const userId = authContext.portalUser.id;

  const [projectsResult, tasksResult, unreadMessagesResult, recentFilesResult] =
    await Promise.all([
      query<DashboardProjectRow>(
        `
          SELECT
            id,
            name,
            summary,
            status,
            start_date,
            target_date,
            last_updated_at
          FROM projects
          WHERE client_id = $1
          ORDER BY last_updated_at DESC
        `,
        [userId]
      ),
      query<DashboardTaskRow>(
        `
          SELECT
            id,
            project_id,
            title,
            description,
            status,
            due_date
          FROM tasks
          WHERE assigned_user_id = $1
            AND status <> 'done'
          ORDER BY due_date ASC NULLS LAST, title ASC
        `,
        [userId]
      ),
      query<CountRow>(
        `
          SELECT COUNT(*)::text AS count
          FROM messages m
          INNER JOIN projects p ON p.id = m.project_id
          WHERE p.client_id = $1
            AND m.read_at IS NULL
            AND m.author_user_id <> $1
        `,
        [userId]
      ),
      query<RecentFileRow>(
        `
          SELECT
            f.id,
            f.project_id,
            f.file_name,
            f.category,
            f.created_at
          FROM files f
          INNER JOIN projects p ON p.id = f.project_id
          WHERE p.client_id = $1
          ORDER BY f.created_at DESC
          LIMIT 5
        `,
        [userId]
      ),
    ]);

  return NextResponse.json({
    user: authContext.portalUser,
    summary: {
      activeProjects: projectsResult.rows.length,
      pendingActions: tasksResult.rows.length,
      unreadMessages: Number(unreadMessagesResult.rows[0]?.count ?? 0),
      recentFiles: recentFilesResult.rows.length,
    },
    projects: projectsResult.rows.map((project) => ({
      id: project.id,
      name: project.name,
      summary: project.summary,
      status: project.status,
      startDate: project.start_date,
      targetDate: project.target_date,
      lastUpdatedAt: new Date(project.last_updated_at).toISOString(),
    })),
    tasks: tasksResult.rows.map((task) => ({
      id: task.id,
      projectId: task.project_id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.due_date ? new Date(task.due_date).toISOString() : null,
    })),
    files: recentFilesResult.rows.map((file) => ({
      id: file.id,
      projectId: file.project_id,
      fileName: file.file_name,
      category: file.category,
      createdAt: new Date(file.created_at).toISOString(),
    })),
  });
}