// app/api/auth/session-init/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getRemainingSessionMaxAge, getSessionCookieOptions } from "@/lib/auth/config"
import { createSessionStore } from "@/lib/auth/session-factory"
import { env } from "@/lib/env"
import { withObservability } from "@/lib/observability/with-observability"

const sessionStore = createSessionStore()

async function handleGet(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sid")

  if (!sessionId) {
    return NextResponse.redirect(`${env.appUrl}/login`)
  }

  const session = await sessionStore.get(sessionId)

  if (!session) {
    return NextResponse.redirect(`${env.appUrl}/login`)
  }

  // Set session cookie and redirect to dashboard
  const response = NextResponse.redirect(`${env.appUrl}/dashboard`)
  response.cookies.set(
    "__session",
    sessionId,
    getSessionCookieOptions(getRemainingSessionMaxAge(session.refreshExpiresAt))
  )

  return response
}

export const GET = withObservability(handleGet, {
  method: "GET",
  route: "/api/auth/session-init",
})