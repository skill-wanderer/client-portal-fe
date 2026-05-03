import { NextResponse } from "next/server";
import { getCurrentPortalAuthContext } from "@/lib/auth/portal-user";
import { query } from "@/lib/db";

interface ProjectListRow {
  id: string;
  name: string;
  summary: string;
  status: string;
  start_date: string | null;
  target_date: string | null;
  last_updated_at: string | Date;
}

export async function GET() {
  const authContext = await getCurrentPortalAuthContext();

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!authContext.portalUser) {
    return NextResponse.json({ error: "user_not_provisioned" }, { status: 403 });
  }

  const projectsResult = await query<ProjectListRow>(
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
    [authContext.portalUser.id]
  );

  return NextResponse.json({
    projects: projectsResult.rows.map((project) => ({
      id: project.id,
      name: project.name,
      summary: project.summary,
      status: project.status,
      startDate: project.start_date,
      targetDate: project.target_date,
      lastUpdatedAt: new Date(project.last_updated_at).toISOString(),
    })),
  });
}