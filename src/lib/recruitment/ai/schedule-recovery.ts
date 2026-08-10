import "server-only";

import { after } from "next/server";
import { logger } from "@/lib/observability/logger";
import { createCandidateAiRecoveryService } from "@/lib/recruitment/services/candidate-ai-recovery-service";

/**
 * Fire-and-forget field recovery after resume draft creation.
 * Never throws to caller. Not a durable queue.
 */
export function scheduleCandidateAiFieldRecovery(input: {
  candidateId: string;
  sourceDraftId: string;
  createdByUserId?: string | null;
}): void {
  logger.info("recruitment.ai.recovery.scheduled", {
    entityType: "candidate",
    entityId: input.candidateId,
    sourceDraftId: input.sourceDraftId,
  });

  after(async () => {
    const service = createCandidateAiRecoveryService();
    const result = await service.tryGenerateFromResumeDraft({
      candidateId: input.candidateId,
      sourceDraftId: input.sourceDraftId,
      createdByUserId: input.createdByUserId ?? null,
    });

    if (result.skipped) {
      logger.info("recruitment.ai.recovery.skipped", {
        entityType: "candidate",
        entityId: input.candidateId,
        sourceDraftId: input.sourceDraftId,
        reason: result.skipped,
      });
      return;
    }
    if (result.error) {
      logger.warn("recruitment.ai.recovery.failed", {
        entityType: "candidate",
        entityId: input.candidateId,
        sourceDraftId: input.sourceDraftId,
        reason: result.error,
      });
      return;
    }
    if (result.reused) {
      logger.info("recruitment.ai.recovery.reused", {
        entityType: "candidate",
        entityId: input.candidateId,
        sourceDraftId: input.sourceDraftId,
        insightId: result.insightId,
      });
      return;
    }
    logger.info("recruitment.ai.recovery.completed", {
      entityType: "candidate",
      entityId: input.candidateId,
      sourceDraftId: input.sourceDraftId,
      insightId: result.insightId,
    });
  });
}
