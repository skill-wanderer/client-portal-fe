import { type NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const sessionId = request.cookies.get("__session")?.value;

  if (!sessionId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await sessionStore.get(sessionId);

  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("__session");
    return response;
  }

  const now = Math.floor(Date.now() / 1000);
  if (session.refreshExpiresAt < now) {
    await sessionStore.delete(sessionId);
    const response = NextResponse.redirect(
      new URL("/login?error=session_expired", request.url)
    );
    response.cookies.delete("__session");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};