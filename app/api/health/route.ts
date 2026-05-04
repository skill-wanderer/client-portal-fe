import { NextResponse } from "next/server";
import { withObservability } from "@/lib/observability/with-observability";

export const dynamic = "force-dynamic";

async function handleGet() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "client-portal",
  });
}

export const GET = withObservability(handleGet, {
  method: "GET",
  route: "/api/health",
});