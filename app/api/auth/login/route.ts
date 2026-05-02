// app/api/auth/login/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { getAuthorizationUrl } from "@/lib/auth/keycloak";

/**
 * GET /api/auth/login
 *
 * Generates CSRF state, stores it in httpOnly cookie,
 * then redirects to Keycloak authorization endpoint.
 */
export async function GET() {
  const cookieStore = await cookies();

  const state = randomBytes(32).toString("hex");

  cookieStore.set("__state", state, {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });

  const authUrl = getAuthorizationUrl(state);
  return NextResponse.redirect(authUrl);
}
