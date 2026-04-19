import { type NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@/lib/auth/session";

/** Routes that do not require authentication */
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/callback", "/api/auth/logout"];

/**
 * Middleware for route protection.
 * Validates session cookie and enforces auth on protected routes.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionId = request.cookies.get("__session")?.value;

  if (!sessionId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Validate session exists in store
  const session = await sessionStore.get(sessionId);

  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("__session");
    return response;
  }

  // Check if refresh token has expired (session is dead)
  const now = Math.floor(Date.now() / 1000);
  if (session.refreshExpiresAt < now) {
    await sessionStore.delete(sessionId);
    const response = NextResponse.redirect(new URL("/login?error=session_expired", request.url));
    response.cookies.delete("__session");
    return response;
  }

  // Session valid — proceed
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
