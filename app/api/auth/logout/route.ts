import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getLogoutUrl } from "@/lib/auth/keycloak";
import { createSessionStore } from "@/lib/auth/session-factory";
import { withObservability } from "@/lib/observability/with-observability";

const sessionStore = createSessionStore();

/**
 * POST /api/auth/logout
 *
 * Destroys server-side session, clears cookie,
 * redirects to Keycloak logout endpoint.
 */
async function handlePost(request: NextRequest) {
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
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}

export const POST = withObservability(handlePost, {
  method: "POST",
  route: "/api/auth/logout",
});
