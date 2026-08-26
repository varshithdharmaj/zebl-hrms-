import { processNotificationQueue } from "../../src/lib/notifications/worker";
import { runManagedWorkerCli } from "../../src/lib/workers/worker-manager";

void runManagedWorkerCli({
  name: "notifications",
  intervalMs: parseInt(process.env.WORKER_INTERVAL_MS ?? "30000", 10),
  runOnce: async () => {
    const result = await processNotificationQueue({ limit: 50 });
    return result as Record<string, unknown>;
  },
});
