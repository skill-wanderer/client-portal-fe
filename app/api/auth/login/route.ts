// app/api/auth/login/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getAuthorizationUrl } from "@/lib/auth/keycloak";

/**
 * GET /api/auth/login
 *
 * Generates CSRF state, stores it in httpOnly cookie,
 * then redirects to Keycloak authorization endpoint.
 */
export async function GET() {
  const cookieStore = await cookies();

  // Prevent double login from overwriting state
  const existing = cookieStore.get("__state");
  if (existing) {
    const authUrl = getAuthorizationUrl(existing.value);
    return NextResponse.redirect(authUrl);
  }

  const state = randomBytes(32).toString("hex");

  cookieStore.set("__state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    path: "/",
    maxAge: 300,
  });

  const authUrl = getAuthorizationUrl(state);
  return NextResponse.redirect(authUrl);
}
