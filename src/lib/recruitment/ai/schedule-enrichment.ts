import "server-only";

import { after } from "next/server";
import { logger } from "@/lib/observability/logger";
import { createCandidateAiEnrichmentService } from "@/lib/recruitment/services/candidate-ai-enrichment-service";

/**
 * Fire-and-forget enrichment after resume draft creation (never throws to caller).
 * Uses Next.js after() — acceptable for internal MVP; not a durable queue.
 */
export function scheduleCandidateAiEnrichment(input: {
  candidateId: string;
  sourceDraftId: string;
  createdByUserId?: string | null;
}): void {
  logger.info("recruitment.ai.enrichment.scheduled", {
    entityType: "candidate",
    entityId: input.candidateId,
    sourceDraftId: input.sourceDraftId,
  });

  after(async () => {
    const service = createCandidateAiEnrichmentService();
    const result = await service.tryGenerateFromResumeDraft({
      candidateId: input.candidateId,
      sourceDraftId: input.sourceDraftId,
      createdByUserId: input.createdByUserId ?? null,
    });

    if (result.skipped) {
      logger.info("recruitment.ai.enrichment.skipped", {
        entityType: "candidate",
        entityId: input.candidateId,
        sourceDraftId: input.sourceDraftId,
        reason: result.skipped,
      });
      return;
    }
    if (result.error) {
      logger.warn("recruitment.ai.enrichment.failed", {
        entityType: "candidate",
        entityId: input.candidateId,
        sourceDraftId: input.sourceDraftId,
        reason: result.error,
      });
      return;
    }
    if (result.reused) {
      logger.info("recruitment.ai.enrichment.reused", {
        entityType: "candidate",
        entityId: input.candidateId,
        sourceDraftId: input.sourceDraftId,
        insightId: result.insightId,
      });
      return;
    }
    logger.info("recruitment.ai.enrichment.completed", {
      entityType: "candidate",
      entityId: input.candidateId,
      sourceDraftId: input.sourceDraftId,
      insightId: result.insightId,
    });
  });
}
