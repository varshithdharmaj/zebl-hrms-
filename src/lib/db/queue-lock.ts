import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const STUCK_PROCESSING_MS = 15 * 60 * 1000;

export async function releaseStuckNotifications(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_PROCESSING_MS);
  const result = await prisma.notification.updateMany({
    where: {
      status: "processing",
      OR: [
        { lockedAt: { lt: cutoff } },
        { lockedAt: null, updatedAt: { lt: cutoff } },
      ],
    },
    data: {
      status: "pending",
      lockedAt: null,
      lockedBy: null,
    },
  });
  return result.count;
}

export async function releaseStuckIntegrationJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_PROCESSING_MS);
  const result = await prisma.integrationJob.updateMany({
    where: {
      status: "processing",
      OR: [
        { lockedAt: { lt: cutoff } },
        { lockedAt: null, updatedAt: { lt: cutoff } },
      ],
    },
    data: {
      status: "pending",
      lockedAt: null,
      lockedBy: null,
    },
  });
  return result.count;
}

/** Claims due notifications with PostgreSQL FOR UPDATE SKIP LOCKED. */
export async function claimDueNotificationIds(
  limit: number,
  workerId: string,
  maxAttempts: number
): Promise<string[]> {
  const now = new Date();
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      UPDATE notifications
      SET status = 'processing'::"NotificationDeliveryStatus",
          locked_at = ${now},
          locked_by = ${workerId},
          updated_at = ${now}
      WHERE id IN (
        SELECT id FROM notifications
        WHERE status = 'pending'::"NotificationDeliveryStatus"
          AND scheduled_at <= ${now}
          AND attempts < ${maxAttempts}
        ORDER BY scheduled_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `
  );
  return rows.map((r) => r.id);
}

/** Claims due integration jobs with PostgreSQL FOR UPDATE SKIP LOCKED. */
export async function claimDueIntegrationJobIds(
  limit: number,
  workerId: string,
  maxAttempts: number
): Promise<string[]> {
  const now = new Date();
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      UPDATE integration_jobs
      SET status = 'processing'::"IntegrationJobStatus",
          locked_at = ${now},
          locked_by = ${workerId},
          updated_at = ${now}
      WHERE id IN (
        SELECT id FROM integration_jobs
        WHERE status = 'pending'::"IntegrationJobStatus"
          AND scheduled_at <= ${now}
          AND attempts < ${maxAttempts}
        ORDER BY scheduled_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `
  );
  return rows.map((r) => r.id);
}
