// app/api/auth/session-init/route.ts
import { NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sid")

  if (!sessionId) {
    return NextResponse.redirect(`${env.appUrl}/login`)
  }

  // Set session cookie and redirect to dashboard
  const response = NextResponse.redirect(`${env.appUrl}/dashboard`)
  response.cookies.set("__session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  })

  return response
}