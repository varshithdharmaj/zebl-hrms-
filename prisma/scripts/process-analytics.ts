import { runAnalyticsAggregation } from "../../src/lib/analytics/analytics-engine";
import { runManagedWorkerCli } from "../../src/lib/workers/worker-manager";

void runManagedWorkerCli({
  name: "analytics",
  runOnce: async (correlationId) => {
    const result = await runAnalyticsAggregation(correlationId);
    return { ok: true, correlationId, ...result } as Record<string, unknown>;
  },
});
