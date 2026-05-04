import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit/audit";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { requireRole } from "@/lib/auth/rbac";
import { query } from "@/lib/db";
import { withObservability } from "@/lib/observability/with-observability";

interface ProjectOwnershipRow {
  id: string;
}

interface ProjectMessageRow {
  id: string;
  author_user_id: string;
  body: string;
  created_at: string | Date;
  read_at: string | Date | null;
}

async function handleGet(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
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

  const { projectId } = await params;

  const projectResult = await query<ProjectOwnershipRow>(
    `
      SELECT id
      FROM projects
      WHERE id = $1
        AND client_id = $2
      LIMIT 1
    `,
    [projectId, authContext.userId]
  );

  if (!projectResult.rowCount) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const messagesResult = await query<ProjectMessageRow>(
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
  );

  return NextResponse.json({
    messages: messagesResult.rows.map((message) => ({
      id: message.id,
      authorUserId: message.author_user_id,
      body: message.body,
      createdAt: new Date(message.created_at).toISOString(),
      readAt: message.read_at ? new Date(message.read_at).toISOString() : null,
    })),
  });
}

async function handlePost(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
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

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const messageBody =
    typeof payload === "object" &&
    payload !== null &&
    "body" in payload &&
    typeof payload.body === "string"
      ? payload.body.trim()
      : "";

  if (!messageBody) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { projectId } = await params;

  const projectResult = await query<ProjectOwnershipRow>(
    `
      SELECT id
      FROM projects
      WHERE id = $1
        AND client_id = $2
      LIMIT 1
    `,
    [projectId, authContext.userId]
  );

  if (!projectResult.rowCount) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const insertResult = await query<ProjectMessageRow>(
    `
      INSERT INTO messages (
        project_id,
        author_user_id,
        body
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        author_user_id,
        body,
        created_at,
        read_at
    `,
    [projectId, authContext.userId, messageBody]
  );

  const message = insertResult.rows[0];

  logAudit({
    userId: authContext.userId,
    action: "message.send",
    resource: "message",
    metadata: {
      projectId,
      messageId: message.id,
    },
  });

  return NextResponse.json(
    {
      message: {
        id: message.id,
        authorUserId: message.author_user_id,
        body: message.body,
        createdAt: new Date(message.created_at).toISOString(),
        readAt: message.read_at ? new Date(message.read_at).toISOString() : null,
      },
    },
    { status: 201 }
  );
}

export const GET = withObservability(handleGet, {
  method: "GET",
  route: "/api/projects/[projectId]/messages",
});

export const POST = withObservability(handlePost, {
  method: "POST",
  route: "/api/projects/[projectId]/messages",
});