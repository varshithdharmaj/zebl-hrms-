import { NextResponse } from "next/server";
import { runShallowHealth } from "@/lib/health/health-check";

export async function GET() {
  const health = await runShallowHealth();
  const status = health.status === "ok" ? 200 : 503;
  return NextResponse.json(health, { status });
}
