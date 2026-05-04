import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookieOptions } from "@/lib/auth/config";
import { refreshAccessToken } from "@/lib/auth/keycloak";
import { createSessionStore } from "@/lib/auth/session-factory";
import {
  attachCorrelationId,
  getOrCreateCorrelationId,
} from "@/lib/observability/correlation";
import {
  logError,
  logInfo,
  logWarn,
} from "@/lib/observability/logger";

const sessionStore = createSessionStore();

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health", "/api/ready"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const correlationId = getOrCreateCorrelationId(request);

  logInfo({
    message: "proxy_request_entry",
    correlationId,
    method: request.method,
    path: pathname,
  });

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    const response = NextResponse.next();
    attachCorrelationId(response, correlationId);
    return response;
  }

  const sessionId = request.cookies.get("__session")?.value;

  if (!sessionId) {
    logWarn({
      message: "proxy_missing_session",
      correlationId,
      method: request.method,
      path: pathname,
      status: 307,
    });
    const response = NextResponse.redirect(new URL("/login", request.url));
    attachCorrelationId(response, correlationId);
    return response;
  }

  const session = await sessionStore.get(sessionId);

  if (!session) {
    logWarn({
      message: "proxy_stale_session",
      correlationId,
      method: request.method,
      path: pathname,
      status: 307,
    });
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("__session");
    attachCorrelationId(response, correlationId);
    return response;
  }

  const now = Math.floor(Date.now() / 1000);
  if (session.refreshExpiresAt < now) {
    logWarn({
      message: "proxy_session_expired",
      correlationId,
      method: request.method,
      path: pathname,
      status: 307,
    });
    await sessionStore.delete(sessionId);
    const response = NextResponse.redirect(
      new URL("/login?error=session_expired", request.url)
    );
    response.cookies.delete("__session");
    attachCorrelationId(response, correlationId);
    return response;
  }

  if (session.accessExpiresAt < now) {
    try {
      logInfo({
        message: "proxy_session_refresh_start",
        correlationId,
        method: request.method,
        path: pathname,
      });
      const tokens = await refreshAccessToken(session.refreshToken);
      await sessionStore.set(sessionId, {
        ...session,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        accessExpiresAt: now + tokens.expires_in,
        refreshExpiresAt: now + tokens.refresh_expires_in,
      });

      const response = NextResponse.next();
      response.cookies.set(
        "__session",
        sessionId,
        getSessionCookieOptions(tokens.refresh_expires_in)
      );
      attachCorrelationId(response, correlationId);
      logInfo({
        message: "proxy_session_refreshed",
        correlationId,
        method: request.method,
        path: pathname,
        status: response.status,
      });
      return response;
    } catch (error) {
      logError({
        message: "proxy_session_refresh_failed",
        correlationId,
        method: request.method,
        path: pathname,
        status: 307,
        error,
      });
      await sessionStore.delete(sessionId);
      const response = NextResponse.redirect(
        new URL("/login?error=session_expired", request.url)
      );
      response.cookies.delete("__session");
      attachCorrelationId(response, correlationId);
      return response;
    }
  }

  const response = NextResponse.next();
  attachCorrelationId(response, correlationId);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};