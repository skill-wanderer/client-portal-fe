import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { withObservability } from "@/lib/observability/with-observability";

export const dynamic = "force-dynamic";

async function handleGet() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json({ status: "not_ready" }, { status: 503 });
  }
}

export const GET = withObservability(handleGet, {
  method: "GET",
  route: "/api/ready",
});