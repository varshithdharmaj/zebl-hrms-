import { IntegrationJobStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";

const MAX_JOB_ATTEMPTS = 5;
export const INTEGRATION_BATCH_SIZE = 15;

export type IntegrationJobType =
  | "calendar_sync"
  | "calendar_delete"
  | "escalation_scan"
  | "org_sync"
  | "teams_notify"
  | "analytics_aggregate";

export async function enqueueIntegrationJob(input: {
  jobType: IntegrationJobType;
  payload: Record<string, unknown>;
  correlationId?: string;
  scheduledAt?: Date;
}): Promise<string> {
  const row = await prisma.integrationJob.create({
    data: {
      jobType: input.jobType,
      payload: JSON.stringify(input.payload),
      correlationId: input.correlationId ?? null,
      scheduledAt: input.scheduledAt ?? new Date(),
    },
  });

  await writeAuditLog({
    entityType: "integration_job",
    entityId: row.id,
    action: AUDIT_ACTIONS.INTEGRATION_JOB_QUEUED,
    metadata: { jobType: input.jobType, correlationId: input.correlationId },
  });

  return row.id;
}

export async function fetchDueIntegrationJobs(limit = INTEGRATION_BATCH_SIZE) {
  return prisma.integrationJob.findMany({
    where: {
      status: IntegrationJobStatus.pending,
      scheduledAt: { lte: new Date() },
      attempts: { lt: MAX_JOB_ATTEMPTS },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
}

export async function markJobProcessing(id: string): Promise<boolean> {
  const updated = await prisma.integrationJob.updateMany({
    where: { id, status: IntegrationJobStatus.pending },
    data: { status: IntegrationJobStatus.processing },
  });
  return updated.count > 0;
}

export async function markJobCompleted(id: string): Promise<void> {
  await prisma.integrationJob.update({
    where: { id },
    data: {
      status: IntegrationJobStatus.completed,
      completedAt: new Date(),
      lastError: null,
      lockedAt: null,
      lockedBy: null,
    },
  });
}

export async function markJobFailed(id: string, error: string, attempts: number): Promise<void> {
  const next = attempts + 1;
  const dead = next >= MAX_JOB_ATTEMPTS;
  const backoffMs = Math.min(2 ** next * 60_000, 3_600_000);

  await prisma.integrationJob.update({
    where: { id },
    data: {
      status: dead ? IntegrationJobStatus.failed : IntegrationJobStatus.pending,
      attempts: next,
      lastError: error.slice(0, 2000),
      scheduledAt: dead ? undefined : new Date(Date.now() + backoffMs),
      lockedAt: null,
      lockedBy: null,
    },
  });

  await writeAuditLog({
    entityType: "integration_job",
    entityId: id,
    action: dead ? AUDIT_ACTIONS.INTEGRATION_JOB_FAILED : AUDIT_ACTIONS.INTEGRATION_JOB_RETRIED,
    metadata: { error: error.slice(0, 300), attempts: next },
  });
}
