import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getAuthorizationUrl } from "@/lib/auth/keycloak";
import { env } from "@/lib/env";

/**
 * GET /api/auth/login
 *
 * Generates CSRF state, stores it in httpOnly cookie,
 * then redirects to Keycloak authorization endpoint.
 */
export async function GET() {
  const state = randomBytes(32).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("__state", state, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: 300, // 5 minutes
  });

  const authUrl = getAuthorizationUrl(state);
  return NextResponse.redirect(authUrl);
}
