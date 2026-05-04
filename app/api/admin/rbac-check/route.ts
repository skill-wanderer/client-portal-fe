import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { requireRole } from "@/lib/auth/rbac";
import { withObservability } from "@/lib/observability/with-observability";

async function handleGet() {
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

  requireRole(authContext.user, ["admin"]);

  return NextResponse.json({ status: "ok" });
}

export const GET = withObservability(handleGet, {
  method: "GET",
  route: "/api/admin/rbac-check",
});