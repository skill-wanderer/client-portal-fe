import { NextResponse } from "next/server";
import { getCurrentPortalAuthContext } from "@/lib/auth/portal-user";
import { query } from "@/lib/db";

interface ProjectOwnershipRow {
  id: string;
}

interface ProjectFileRow {
  id: string;
  uploaded_by_user_id: string;
  file_name: string;
  storage_key: string;
  mime_type: string;
  size_bytes: string;
  category: string;
  created_at: string | Date;
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

  const projectResult = await query<ProjectOwnershipRow>(
    `
      SELECT id
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

  const filesResult = await query<ProjectFileRow>(
    `
      SELECT
        id,
        uploaded_by_user_id,
        file_name,
        storage_key,
        mime_type,
        size_bytes,
        category,
        created_at
      FROM files
      WHERE project_id = $1
      ORDER BY created_at DESC
    `,
    [projectId]
  );

  return NextResponse.json({
    files: filesResult.rows.map((file) => ({
      id: file.id,
      uploadedByUserId: file.uploaded_by_user_id,
      fileName: file.file_name,
      storageKey: file.storage_key,
      mimeType: file.mime_type,
      sizeBytes: Number(file.size_bytes),
      category: file.category,
      createdAt: new Date(file.created_at).toISOString(),
    })),
  });
}