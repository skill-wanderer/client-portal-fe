import { NextResponse } from "next/server";
import { getCurrentPortalAuthContext } from "@/lib/auth/portal-user";
import { query } from "@/lib/db";

interface ProjectDetailRow {
  id: string;
  name: string;
  summary: string;
  status: string;
  start_date: string | null;
  target_date: string | null;
  last_updated_at: string | Date;
}

interface ProjectTaskRow {
  id: string;
  assigned_user_id: string;
  title: string;
  description: string;
  status: string;
  due_date: string | Date | null;
  completed_at: string | Date | null;
}

interface ProjectMessageRow {
  id: string;
  author_user_id: string;
  body: string;
  created_at: string | Date;
  read_at: string | Date | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  let authContext;

  try {
    authContext = await getCurrentPortalAuthContext();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "portal_user_not_found") {
        return NextResponse.json({ error: "user_not_provisioned" }, { status: 403 });
      }

      if (error.message === "portal_user_ambiguous") {
        return NextResponse.json(
          { error: "user_mapping_conflict" },
          { status: 500 }
        );
      }

      if (error.message === "missing_session_user_email") {
        return NextResponse.json(
          { error: "invalid_session_profile" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const projectResult = await query<ProjectDetailRow>(
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
      WHERE id = $1
        AND client_id = $2
      LIMIT 1
    `,
    [projectId, authContext.portalUser.id]
  );

  if (!projectResult.rowCount) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [tasksResult, messagesResult] = await Promise.all([
    query<ProjectTaskRow>(
      `
        SELECT
          id,
          assigned_user_id,
          title,
          description,
          status,
          due_date,
          completed_at
        FROM tasks
        WHERE project_id = $1
        ORDER BY due_date ASC NULLS LAST, title ASC
      `,
      [projectId]
    ),
    query<ProjectMessageRow>(
      `
        SELECT
          id,
          author_user_id,
          body,
          created_at,
          read_at
        FROM messages
        WHERE project_id = $1
        ORDER BY created_at ASC
      `,
      [projectId]
    ),
  ]);

  const project = projectResult.rows[0];

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      summary: project.summary,
      status: project.status,
      startDate: project.start_date,
      targetDate: project.target_date,
      lastUpdatedAt: new Date(project.last_updated_at).toISOString(),
    },
    tasks: tasksResult.rows.map((task) => ({
      id: task.id,
      assignedUserId: task.assigned_user_id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.due_date ? new Date(task.due_date).toISOString() : null,
      completedAt: task.completed_at
        ? new Date(task.completed_at).toISOString()
        : null,
    })),
    messages: messagesResult.rows.map((message) => ({
      id: message.id,
      authorUserId: message.author_user_id,
      body: message.body,
      createdAt: new Date(message.created_at).toISOString(),
      readAt: message.read_at ? new Date(message.read_at).toISOString() : null,
    })),
  });
}