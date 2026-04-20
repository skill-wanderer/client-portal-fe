// app/api/auth/callback/route.ts
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

  console.log("CALLBACK HIT");
  console.log("CODE:", code);
  console.log("STATE:", state);

  // Validate required params
  if (!code || !state) {
    loginUrl.searchParams.set("error", "invalid_state");
    console.log("REDIRECT LOGIN REASON");
    return NextResponse.redirect(loginUrl);
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("__state")?.value;

  console.log("STORED STATE:", storedState);

  if (!storedState || storedState !== state) {
    loginUrl.searchParams.set("error", "invalid_state");
    console.log("REDIRECT LOGIN REASON");
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
    console.log("REDIRECT LOGIN REASON");
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

  // Redirect to same-site session-init to set cookie (avoids cross-site redirect cookie drop)
  console.log("REDIRECT TO SESSION INIT:", sessionId);
  const sessionInitUrl = new URL("/api/auth/session-init", env.appUrl);
  sessionInitUrl.searchParams.set("sid", sessionId);

  const response = NextResponse.redirect(sessionInitUrl);
  response.cookies.delete("__state");

  console.log("COOKIES:", request.headers.get("cookie"));
  
  return response;
}
