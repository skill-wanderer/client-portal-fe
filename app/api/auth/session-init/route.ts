// app/api/auth/session-init/route.ts
import { NextRequest, NextResponse } from "next/server"
import { env } from "@/lib/env"

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sid")

  if (!sessionId) {
    return NextResponse.redirect(`${env.appUrl}/login`)
  }

  // 🚨 PASS SESSION VIA QUERY (TEMP SOLUTION)
  return NextResponse.redirect(
    `${env.appUrl}/dashboard?session=${sessionId}`
  )
}