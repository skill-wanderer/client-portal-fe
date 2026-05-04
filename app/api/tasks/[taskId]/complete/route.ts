import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit/audit";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { requireRole } from "@/lib/auth/rbac";
import { query } from "@/lib/db";
import { withObservability } from "@/lib/observability/with-observability";

interface CompletedTaskRow {
  id: string;
  project_id: string;
  assigned_user_id: string;
  title: string;
  description: string;
  status: string;
  due_date: string | Date | null;
  completed_at: string | Date | null;
}

async function handlePost(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  let authContext;

  try {
    authContext = await getAuthContext();
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

  requireRole(authContext.user, ["client"]);

  const { taskId } = await params;

  const taskResult = await query<CompletedTaskRow>(
    `
      UPDATE tasks AS t
      SET
        status = 'done',
        completed_at = COALESCE(t.completed_at, NOW())
      FROM projects AS p
      WHERE t.project_id = p.id
        AND t.id = $1
        AND p.client_id = $2
        AND t.assigned_user_id = $2
      RETURNING
        t.id,
        t.project_id,
        t.assigned_user_id,
        t.title,
        t.description,
        t.status,
        t.due_date,
        t.completed_at
    `,
    [taskId, authContext.userId]
  );

  if (!taskResult.rowCount) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const task = taskResult.rows[0];

  logAudit({
    userId: authContext.userId,
    action: "task.complete",
    resource: "task",
    metadata: {
      taskId: task.id,
      projectId: task.project_id,
    },
  });

  return NextResponse.json({
    task: {
      id: task.id,
      projectId: task.project_id,
      assignedUserId: task.assigned_user_id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.due_date ? new Date(task.due_date).toISOString() : null,
      completedAt: task.completed_at
        ? new Date(task.completed_at).toISOString()
        : null,
    },
  });
}

export const POST = withObservability(handlePost, {
  method: "POST",
  route: "/api/tasks/[taskId]/complete",
});