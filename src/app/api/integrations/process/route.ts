import { NextResponse } from "next/server";
import { processIntegrationJobs } from "@/lib/integrations/integration-worker";
import { processNotificationQueue } from "@/lib/notifications/worker";
import { runEscalationScan } from "@/lib/workflow/escalation-engine";
import { authorizeCronOrAdmin, getCronSecrets } from "@/lib/auth/cron-auth";
import { runManagedWorkerOnce } from "@/lib/workers/worker-manager";

export async function POST(request: Request) {
  const { integration } = getCronSecrets();
  if (!(await authorizeCronOrAdmin(request, [integration]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runManagedWorkerOnce({
    name: "integrations-api",
    runOnce: async (correlationId) => {
      const escalation = await runEscalationScan(correlationId);
      const integrations = await processIntegrationJobs({ limit: 30 });
      const notifications = await processNotificationQueue({ limit: 30 });
      return { escalation, integrations, notifications };
    },
  });

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
