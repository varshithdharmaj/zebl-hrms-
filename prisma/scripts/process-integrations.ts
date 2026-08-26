import { processIntegrationJobs } from "../../src/lib/integrations/integration-worker";
import { runEscalationScan } from "../../src/lib/workflow/escalation-engine";
import { processNotificationQueue } from "../../src/lib/notifications/worker";
import { runManagedWorkerCli } from "../../src/lib/workers/worker-manager";

void runManagedWorkerCli({
  name: "integrations",
  intervalMs: parseInt(process.env.WORKER_INTERVAL_MS ?? "60000", 10),
  runOnce: async (correlationId) => {
    const escalation = await runEscalationScan(correlationId);
    const jobs = await processIntegrationJobs({ limit: 15 });
    const notifications = await processNotificationQueue({ limit: 30 });
    return {
      escalation,
      jobs,
      notifications,
    } as Record<string, unknown>;
  },
});
