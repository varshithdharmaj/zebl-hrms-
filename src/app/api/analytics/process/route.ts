import { NextResponse } from "next/server";
import { authorizeCronOrAdmin, getCronSecrets } from "@/lib/auth/cron-auth";
import { runAnalyticsAggregation } from "@/lib/analytics/analytics-engine";
import { runManagedWorkerOnce } from "@/lib/workers/worker-manager";

export async function POST(request: Request) {
  const { analytics, integration } = getCronSecrets();
  if (!(await authorizeCronOrAdmin(request, [analytics, integration]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runManagedWorkerOnce({
    name: "analytics-api",
    runOnce: async (correlationId) => {
      const agg = await runAnalyticsAggregation(correlationId);
      return { success: true, ...agg, correlationId };
    },
  });

  return NextResponse.json(result);
}
