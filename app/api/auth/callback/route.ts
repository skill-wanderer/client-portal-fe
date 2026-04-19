import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { decodeIdToken, exchangeCode, extractUser } from "@/lib/auth/keycloak";
import { sessionStore } from "@/lib/auth/session";
import { env } from "@/lib/env";

/**
 * GET /api/auth/callback
 *
 * Keycloak redirects here with ?code=...&state=...
 * Validates CSRF state, exchanges code for tokens,
 * creates server-side session, sets session cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const loginUrl = new URL("/login", env.appUrl);

  // Validate required params
  if (!code || !state) {
    loginUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(loginUrl);
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("__state")?.value;

  if (!storedState || storedState !== state) {
    loginUrl.searchParams.set("error", "invalid_state");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("__state");
    return response;
  }

  // Exchange code for tokens
  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch {
    loginUrl.searchParams.set("error", "auth_failed");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("__state");
    return response;
  }

  // Decode id_token and extract user
  const payload = decodeIdToken(tokens.id_token);
  const user = extractUser(payload);

  // Create session
  const now = Math.floor(Date.now() / 1000);
  const sessionId = randomUUID();

  await sessionStore.set(sessionId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    user,
    accessExpiresAt: now + tokens.expires_in,
    refreshExpiresAt: now + tokens.refresh_expires_in,
    createdAt: now,
  });

  // Set session cookie + clear state cookie
  const dashboardUrl = new URL("/dashboard", env.appUrl);
  const response = NextResponse.redirect(dashboardUrl);

  response.cookies.set("__session", sessionId, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: tokens.refresh_expires_in,
  });

  response.cookies.delete("__state");

  return response;
}
