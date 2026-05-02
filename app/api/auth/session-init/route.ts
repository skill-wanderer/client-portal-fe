// app/api/auth/session-init/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getRemainingSessionMaxAge, getSessionCookieOptions } from "@/lib/auth/config"
import { sessionStore } from "@/lib/auth/session"
import { env } from "@/lib/env"

export async function GET(req: NextRequest) {
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