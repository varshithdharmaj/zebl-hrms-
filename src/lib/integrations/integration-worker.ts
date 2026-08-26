import { prisma } from "@/lib/prisma";
import {
  claimDueIntegrationJobIds,
  releaseStuckIntegrationJobs,
} from "@/lib/db/queue-lock";
import {
  markJobCompleted,
  markJobFailed,
} from "@/lib/integrations/integration-queue";
import {
  syncApprovedLeaveToCalendar,
  removeLeaveFromCalendar,
} from "@/lib/calendar/calendar-events";
import { runEscalationScan } from "@/lib/workflow/escalation-engine";
import { runOrganizationSync } from "@/lib/microsoft/org-sync";
import { runAnalyticsAggregation } from "@/lib/analytics/analytics-engine";
import { logger } from "@/lib/observability/logger";

const MAX_JOB_ATTEMPTS = 5;
export const INTEGRATION_BATCH_SIZE = 15;

export type IntegrationWorkerResult = {
  processed: number;
  completed: number;
  failed: number;
  released: number;
};

async function executeJob(
  jobType: string,
  payload: Record<string, unknown>,
  correlationId?: string | null
): Promise<void> {
  switch (jobType) {
    case "calendar_sync": {
      const leaveRequestId = payload.leaveRequestId as number;
      await syncApprovedLeaveToCalendar(leaveRequestId, correlationId ?? undefined);
      return;
    }
    case "calendar_delete": {
      const leaveRequestId = payload.leaveRequestId as number;
      await removeLeaveFromCalendar(leaveRequestId, correlationId ?? undefined);
      return;
    }
    case "escalation_scan": {
      await runEscalationScan(correlationId ?? `escalation-${Date.now()}`);
      return;
    }
    case "org_sync": {
      await runOrganizationSync(correlationId ?? `org-sync-${Date.now()}`);
      return;
    }
    case "analytics_aggregate": {
      await runAnalyticsAggregation(correlationId ?? `analytics-${Date.now()}`);
      return;
    }
    default:
      throw new Error(`Unknown integration job type: ${jobType}`);
  }
}

export async function processIntegrationJobs(opts?: {
  limit?: number;
  workerId?: string;
}): Promise<IntegrationWorkerResult> {
  const limit = opts?.limit ?? INTEGRATION_BATCH_SIZE;
  const workerId = opts?.workerId ?? `integrations-${process.pid}`;

  const released = await releaseStuckIntegrationJobs();
  if (released > 0) {
    logger.warn("Released stuck integration jobs", { worker: workerId, released });
  }

  const ids = await claimDueIntegrationJobIds(limit, workerId, MAX_JOB_ATTEMPTS);
  let completed = 0;
  let failed = 0;

  for (const id of ids) {
    const job = await prisma.integrationJob.findUnique({ where: { id } });
    if (!job) continue;

    try {
      const payload = JSON.parse(job.payload) as Record<string, unknown>;
      await executeJob(job.jobType, payload, job.correlationId);
      await markJobCompleted(job.id);
      completed += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Integration job failed";
      await markJobFailed(job.id, message, job.attempts);
      failed += 1;
    }
  }

  return { processed: ids.length, completed, failed, released };
}
