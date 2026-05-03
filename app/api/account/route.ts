import { NextResponse } from "next/server";
import { getCurrentPortalAuthContext } from "@/lib/auth/portal-user";
import { query } from "@/lib/db";

interface AccountUserRow {
  id: string;
  role: "client" | "admin";
  display_name: string;
  email: string;
  company_name: string | null;
  status: "active" | "inactive";
  created_at: string | Date;
  updated_at: string | Date;
}

export async function GET() {
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

  return NextResponse.json({ user: authContext.portalUser });
}

export async function PATCH(request: Request) {
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

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const displayName =
    typeof payload === "object" &&
    payload !== null &&
    "displayName" in payload &&
    typeof payload.displayName === "string"
      ? payload.displayName.trim()
      : "";

  if (!displayName) {
    return NextResponse.json({ error: "invalid_display_name" }, { status: 400 });
  }

  const userResult = await query<AccountUserRow>(
    `
      UPDATE users
      SET
        display_name = $2,
        updated_at = NOW()
      WHERE id = $1
        AND status = 'active'
      RETURNING
        id,
        role,
        display_name,
        email,
        company_name,
        status,
        created_at,
        updated_at
    `,
    [authContext.portalUser.id, displayName]
  );

  if (!userResult.rowCount) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const user = userResult.rows[0];

  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      displayName: user.display_name,
      email: user.email,
      companyName: user.company_name,
      status: user.status,
      createdAt: new Date(user.created_at).toISOString(),
      updatedAt: new Date(user.updated_at).toISOString(),
    },
  });
}