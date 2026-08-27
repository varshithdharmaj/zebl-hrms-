import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/observability/logger";
import { expireSubmission } from "@/lib/recruitment/public-apply/public-application-service";
import { TERMINAL_STATUSES } from "@/lib/recruitment/public-apply/types";

const DEFAULT_BATCH_SIZE = 100;

export type PublicApplyExpiryBatchResult = {
  scanned: number;
  expired: number;
  failed: number;
};

/**
 * Sweeps PublicApplicationSubmission rows whose TTL has passed but were
 * never revisited — expireSubmission() is otherwise only triggered lazily by
 * the next token access on that same row, which never comes for a genuinely
 * abandoned application (candidate uploads a resume/photo, then never
 * returns). Reuses expireSubmission() as-is so behavior — temp-blob delete,
 * status flip, key nulling — is identical whether a row expires via a user's
 * next request or via this sweep.
 *
 * Bounded and re-runnable: only `batchSize` rows per call (repeated
 * scheduler invocations drain a larger backlog over time), and each row's
 * expiry is independently try/caught so one failure never blocks the rest
 * of the batch. Never touches CandidateDocument or any already-terminal
 * (submitted/job_closed/expired) row — the query filter excludes them, and
 * expireSubmission()'s own updateMany guard excludes them a second time.
 */
export async function runPublicApplyExpiryBatch(
  options: { batchSize?: number; asOf?: Date } = {}
): Promise<PublicApplyExpiryBatchResult> {
  const asOf = options.asOf ?? new Date();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  const rows = await prisma.publicApplicationSubmission.findMany({
    where: {
      expiresAt: { lt: asOf },
      status: { notIn: [...TERMINAL_STATUSES] },
    },
    orderBy: { expiresAt: "asc" },
    take: batchSize,
  });

  let expired = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await expireSubmission(row);
      expired += 1;
    } catch (error) {
      failed += 1;
      logger.warn("recruitment.public_apply.expiry_sweep_failed", {
        entityType: "public_application_submission",
        entityId: row.id,
        reason: error instanceof Error ? error.name || "Error" : "unknown",
      });
    }
  }

  return { scanned: rows.length, expired, failed };
}
