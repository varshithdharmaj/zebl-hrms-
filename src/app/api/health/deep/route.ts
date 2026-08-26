import { NextResponse } from "next/server";
import { runDeepHealth } from "@/lib/health/health-check";
import { authorizeCronOrAdmin, getCronSecrets } from "@/lib/auth/cron-auth";

export async function GET(request: Request) {
  const secrets = Object.values(getCronSecrets());
  const authorized = await authorizeCronOrAdmin(request, secrets);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await runDeepHealth();
  const status =
    health.status === "ok" ? 200 : health.status === "degraded" ? 200 : 503;
  return NextResponse.json(health, { status });
}
