import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getLogoutUrl } from "@/lib/auth/keycloak";
import { sessionStore } from "@/lib/auth/session";

/**
 * POST /api/auth/logout
 *
 * Destroys server-side session, clears cookie,
 * redirects to Keycloak logout endpoint.
 */
export async function POST() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("__session")?.value;

  let logoutRedirectUrl: string | null = null;

  if (sessionId) {
    const session = await sessionStore.get(sessionId);
    if (session) {
      logoutRedirectUrl = getLogoutUrl(session.idToken);
      await sessionStore.delete(sessionId);
    }
  }

  // Clear session cookie
  cookieStore.delete("__session");

  // Redirect to Keycloak logout or login page
  const redirectUrl = logoutRedirectUrl ?? "/login";
  return NextResponse.redirect(new URL(redirectUrl));
}
