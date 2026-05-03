import { cookies } from "next/headers";
import type { Session } from "@/types";
import { query } from "@/lib/db";
import { sessionStore } from "@/lib/auth/session";

interface PortalUserRow {
  id: string;
  role: "client" | "admin";
  display_name: string;
  email: string;
  company_name: string | null;
  status: "active" | "inactive";
  created_at: string | Date;
  updated_at: string | Date;
}

export interface PortalUser {
  id: string;
  role: "client" | "admin";
  displayName: string;
  email: string;
  companyName: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface PortalAuthContext {
  sessionId: string;
  session: Session;
  portalUser: PortalUser;
}

export async function getCurrentPortalAuthContext(): Promise<PortalAuthContext | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("__session")?.value;

  if (!sessionId) {
    return null;
  }

  const session = await sessionStore.get(sessionId);

  if (!session) {
    return null;
  }

  const sessionEmail = session.user.email?.trim();

  if (!sessionEmail) {
    throw new Error("missing_session_user_email");
  }

  const result = await query<PortalUserRow>(
    `
      SELECT
        id,
        role,
        display_name,
        email,
        company_name,
        status,
        created_at,
        updated_at
      FROM users
      WHERE email = $1
        AND status = 'active'
    `,
    [sessionEmail]
  );

  const matchingUserCount = result.rows.length;

  if (matchingUserCount === 0) {
    throw new Error("portal_user_not_found");
  }

  if (matchingUserCount > 1) {
    throw new Error("portal_user_ambiguous");
  }

  const row = result.rows[0];

  return {
    sessionId,
    session,
    portalUser: {
      id: row.id,
      role: row.role,
      displayName: row.display_name,
      email: row.email,
      companyName: row.company_name,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    },
  };
}