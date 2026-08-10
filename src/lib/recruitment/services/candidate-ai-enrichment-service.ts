import "server-only";

import { AiInsightStatus, AiInsightType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/session";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import { prismaCandidateRepository } from "@/lib/recruitment/repositories/prisma-candidate-repository";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import { prismaTimelineProjectionRepository } from "@/lib/recruitment/repositories/prisma-timeline-repository";
import { parseResumeImportDraftContent } from "@/lib/recruitment/resume-import/draft-content";
import type { ResumeImportMappedDraft } from "@/lib/recruitment/resume-import/types";
import { buildCandidateEnrichmentContext } from "@/lib/recruitment/ai/build-context";
import {
  computeEnrichmentInputFingerprint,
  enrichmentFingerprintsMatch,
} from "@/lib/recruitment/ai/enrichment-fingerprint";
import { getAiRuntimeConfig } from "@/lib/recruitment/ai/config";
import { createGeminiProvider } from "@/lib/recruitment/ai/gemini-provider";
import { parseEnrichmentInsightContent } from "@/lib/recruitment/ai/enrichment-schema";
import { computeCandidateFieldStatus } from "@/lib/recruitment/ai/field-status";
import type { AiProvider } from "@/lib/recruitment/ai/provider";
import { logger } from "@/lib/observability/logger";
import {
  CANDIDATE_ENRICHMENT_CONTENT_KIND,
  CANDIDATE_ENRICHMENT_PROMPT_VERSION,
  type CandidateEnrichmentInsightContent,
} from "@/lib/recruitment/ai/types";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";

export const ENRICHMENT_STALE_ACCEPT_MESSAGE =
  "This AI suggestion is outdated. Please regenerate it before applying.";

async function assertCandidateManageScope(
  session: SessionUser,
  candidateId: string
): Promise<void> {
  const scope = await RecruitmentScopeEngine.getScope(session);
  RecruitmentScopeEngine.assertCandidateInScope(scope, candidateId);
}

function assertInsightBelongsToCandidate(
  insightCandidateId: string,
  candidateId: string
): void {
  if (insightCandidateId !== candidateId) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "Insight does not belong to this candidate."
    );
  }
}

function sameEnrichmentContext(
  content: CandidateEnrichmentInsightContent,
  documentId: string | null,
  sourceDraftId: string | null
): boolean {
  if (content.promptVersion !== CANDIDATE_ENRICHMENT_PROMPT_VERSION) return false;
  if (documentId && content.documentId === documentId) return true;
  if (sourceDraftId && content.sourceDraftId === sourceDraftId) return true;
  return !documentId && !sourceDraftId && !content.documentId && !content.sourceDraftId;
}

function isFilledText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isUniquePendingViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function isEnrichmentFresh(input: {
  content: CandidateEnrichmentInsightContent;
  candidate: CandidateDetail;
  mapped?: ResumeImportMappedDraft | null;
}): boolean {
  const current = computeEnrichmentInputFingerprint({
    candidate: input.candidate,
    mapped: input.mapped ?? null,
    documentId: input.content.documentId,
    sourceDraftId: input.content.sourceDraftId,
  });
  return enrichmentFingerprintsMatch(input.content.inputFingerprint, current);
}

export function createCandidateAiEnrichmentService(
  repository: CandidateRepository = prismaCandidateRepository,
  provider: AiProvider = createGeminiProvider()
) {
  return {
    /**
     * Non-throwing entry for post-import hook. Never fails resume import.
     */
    async tryGenerateFromResumeDraft(input: {
      candidateId: string;
      sourceDraftId: string;
      createdByUserId?: string | null;
      force?: boolean;
    }): Promise<{
      insightId?: string;
      skipped?: string;
      error?: string;
      reused?: boolean;
    }> {
      try {
        const config = await getAiRuntimeConfig();
        if (!config.enabled) {
          return { skipped: config.reasonDisabled ?? "AI disabled." };
        }

        const result = await this.generateFromResumeDraft({
          candidateId: input.candidateId,
          sourceDraftId: input.sourceDraftId,
          createdByUserId: input.createdByUserId ?? null,
          force: input.force ?? false,
          skipPermissionCheck: true,
        });
        return { insightId: result.insightId, reused: result.reused };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "AI enrichment failed.",
        };
      }
    },

    async generateFromResumeDraft(input: {
      candidateId: string;
      sourceDraftId: string;
      createdByUserId?: string | null;
      force?: boolean;
      session?: SessionUser;
      skipPermissionCheck?: boolean;
    }): Promise<{ insightId: string; reused?: boolean }> {
      RecruitmentPermissionService.requireModuleEnabled();
      if (!input.skipPermissionCheck) {
        if (!input.session) {
          throw new RecruitmentDomainError("REC_UNAUTHORIZED", "Session required.");
        }
        await RecruitmentPermissionService.assertCanManageCandidates(input.session);
        await assertCandidateManageScope(input.session, input.candidateId);
      }

      const config = await getAiRuntimeConfig();
      if (!config.enabled) {
        throw new RecruitmentDomainError(
          "REC_FEATURE_DISABLED",
          config.reasonDisabled ?? "AI enrichment is disabled."
        );
      }

      const candidate = await repository.getCandidate(input.candidateId);
      if (!candidate || candidate.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      const draft = await repository.getInsight(input.sourceDraftId);
      if (!draft || String(draft.candidateId) !== input.candidateId) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Resume draft not found.");
      }
      if (draft.insightType !== AiInsightType.resume_parse) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Source insight is not a resume import draft."
        );
      }

      const draftContent = parseResumeImportDraftContent(draft.contentJson);
      const documentId = draftContent.documentId;
      const inputFingerprint = computeEnrichmentInputFingerprint({
        candidate,
        mapped: draftContent.mapped,
        documentId,
        sourceDraftId: input.sourceDraftId,
      });

      /**
       * Reuse ONLY when promptVersion + draft/document context + fingerprint match.
       * Never reuse an arbitrary pending insight from another resume/draft.
       */
      const findReusable = async (): Promise<string | null> => {
        const existing = await repository.listInsights(input.candidateId, {
          insightType: AiInsightType.candidate_summary,
        });
        for (const row of existing) {
          // Only pending_review is reusable. Accepted/dismissed/superseded are not.
          if (row.status !== AiInsightStatus.pending_review) {
            continue;
          }
          const parsed = parseEnrichmentInsightContent(row.contentJson);
          if (!parsed.ok) continue;
          if (!sameEnrichmentContext(parsed.data, documentId, input.sourceDraftId)) {
            continue;
          }
          if (
            !enrichmentFingerprintsMatch(
              parsed.data.inputFingerprint,
              inputFingerprint
            )
          ) {
            logger.info("recruitment.ai.enrichment_stale", {
              entityType: "candidate",
              entityId: input.candidateId,
              insightId: String(row.id),
              sourceDraftId: input.sourceDraftId,
              reason: "fingerprint_mismatch",
            });
            continue;
          }
          return String(row.id);
        }
        return null;
      };

      if (!input.force) {
        const reusableId = await findReusable();
        if (reusableId) {
          logger.info("recruitment.ai.enrichment_reused", {
            entityType: "candidate",
            entityId: input.candidateId,
            insightId: reusableId,
            sourceDraftId: input.sourceDraftId,
          });
          return { insightId: reusableId, reused: true };
        }
      }

      const fieldStatus = computeCandidateFieldStatus(candidate);
      const context = buildCandidateEnrichmentContext({
        candidate,
        mapped: draftContent.mapped,
      });

      const generated = await provider.generateCandidateEnrichment(context);
      if (!generated.ok) {
        logger.warn("recruitment.ai.enrichment.provider_failed", {
          entityType: "candidate",
          entityId: input.candidateId,
          sourceDraftId: input.sourceDraftId,
          reason: generated.error,
        });
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          `AI enrichment failed: ${generated.error}`
        );
      }

      const content: CandidateEnrichmentInsightContent = {
        version: 1,
        kind: CANDIDATE_ENRICHMENT_CONTENT_KIND,
        promptVersion: CANDIDATE_ENRICHMENT_PROMPT_VERSION,
        documentId,
        sourceDraftId: input.sourceDraftId,
        inputFingerprint,
        fieldStatus,
        enrichment: {
          ...generated.data,
          missingInformation: context.missingFields.slice(0, 20),
        },
        applied: { summary: false, headline: false },
      };

      const events = createAfterCommitBuffer();
      try {
        const insightId = await withRecruitmentTransaction(async (tx) => {
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(${`ai-enrich:${input.candidateId}`})
            )
          `;

          if (!input.force) {
            const reusableId = await findReusable();
            if (reusableId) {
              return { id: reusableId, reused: true as const };
            }
          }

          const pending = await repository.listInsights(input.candidateId, {
            insightType: AiInsightType.candidate_summary,
            status: AiInsightStatus.pending_review,
          });
          for (const row of pending) {
            await repository.updateInsightStatus(
              String(row.id),
              AiInsightStatus.superseded,
              tx,
              {
                reviewedByUserId: input.createdByUserId ?? input.session?.id ?? null,
                reviewedAt: new Date(),
              }
            );
            logger.info("recruitment.ai.enrichment_superseded", {
              entityType: "candidate",
              entityId: input.candidateId,
              insightId: String(row.id),
              sourceDraftId: input.sourceDraftId,
              reason: input.force ? "force_regenerate" : "stale_or_new_context",
            });
          }

          const { id } = await repository.createInsight(
            input.candidateId,
            {
              insightType: AiInsightType.candidate_summary,
              status: AiInsightStatus.pending_review,
              title: "AI candidate enrichment",
              contentJson: content,
              confidence: null,
              modelId: generated.modelId,
              createdByUserId: input.createdByUserId ?? input.session?.id ?? null,
            },
            tx
          );

          await prismaTimelineProjectionRepository.append(
            {
              entityType: "candidate",
              entityId: input.candidateId,
              candidateId: input.candidateId,
              eventType: "candidate_ai_enrichment_created",
              summary: "AI candidate enrichment generated",
              actorUserId: input.createdByUserId ?? input.session?.id ?? null,
              metadata: {
                insightId: id,
                documentId,
                sourceDraftId: input.sourceDraftId,
                modelId: generated.modelId,
                promptVersion: CANDIDATE_ENRICHMENT_PROMPT_VERSION,
              },
            },
            tx
          );

          if (input.session) {
            const actor = toRecruitmentActor(input.session);
            events.enqueue(
              RecruitmentEventFactory.candidateUpdated(actor, {
                candidateId: input.candidateId,
                changedFields: ["aiEnrichment"],
              })
            );
          }

          return { id, reused: false as const };
        });

        await events.flush();
        if (insightId.reused) {
          logger.info("recruitment.ai.enrichment_reused", {
            entityType: "candidate",
            entityId: input.candidateId,
            insightId: insightId.id,
            sourceDraftId: input.sourceDraftId,
          });
          return { insightId: insightId.id, reused: true };
        }
        logger.info("recruitment.ai.enrichment_generated", {
          entityType: "candidate",
          entityId: input.candidateId,
          insightId: insightId.id,
          sourceDraftId: input.sourceDraftId,
        });
        return { insightId: insightId.id };
      } catch (error) {
        if (isUniquePendingViolation(error)) {
          const reusableId = await findReusable();
          if (reusableId) {
            logger.info("recruitment.ai.enrichment_reused", {
              entityType: "candidate",
              entityId: input.candidateId,
              insightId: reusableId,
              sourceDraftId: input.sourceDraftId,
              reason: "unique_pending_conflict",
            });
            return { insightId: reusableId, reused: true };
          }
          // Wrong-context pending won the race — force supersede + create once.
          if (!input.force) {
            logger.warn("recruitment.ai.enrichment_stale", {
              entityType: "candidate",
              entityId: input.candidateId,
              sourceDraftId: input.sourceDraftId,
              reason: "conflict_wrong_pending_context",
            });
            return this.generateFromResumeDraft({
              ...input,
              force: true,
            });
          }
        }
        throw error;
      }
    },

    async listLatestEnrichment(candidateId: string): Promise<{
      insight: Record<string, unknown> | null;
      content: CandidateEnrichmentInsightContent | null;
    }> {
      const rows = await repository.listInsights(candidateId, {
        insightType: AiInsightType.candidate_summary,
      });
      for (const row of rows) {
        if (
          row.status !== AiInsightStatus.pending_review &&
          row.status !== AiInsightStatus.accepted
        ) {
          continue;
        }
        const parsed = parseEnrichmentInsightContent(row.contentJson);
        if (!parsed.ok) continue;
        return { insight: row, content: parsed.data };
      }
      return { insight: null, content: null };
    },

    async dismissEnrichment(
      session: SessionUser,
      input: { insightId: string; candidateId: string }
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const insight = await repository.getInsight(input.insightId);
      if (!insight) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Insight not found.");
      }
      assertInsightBelongsToCandidate(String(insight.candidateId), input.candidateId);
      await assertCandidateManageScope(session, input.candidateId);
      if (insight.insightType !== AiInsightType.candidate_summary) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Not an enrichment insight.");
      }
      if (insight.status !== AiInsightStatus.pending_review) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only pending enrichment insights can be dismissed."
        );
      }

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateInsightStatus(
          input.insightId,
          AiInsightStatus.dismissed,
          tx,
          { reviewedByUserId: session.id, reviewedAt: new Date() }
        );
        await prismaTimelineProjectionRepository.append(
          {
            entityType: "candidate",
            entityId: input.candidateId,
            candidateId: input.candidateId,
            eventType: "candidate_ai_enrichment_dismissed",
            summary: "AI candidate enrichment dismissed",
            actorUserId: session.id,
            metadata: { insightId: input.insightId },
          },
          tx
        );
      });
    },

    async acceptEnrichmentFields(
      session: SessionUser,
      input: {
        insightId: string;
        candidateId: string;
        acceptSummary?: boolean;
        acceptHeadline?: boolean;
        replaceSummary?: boolean;
        replaceHeadline?: boolean;
        editedSummary?: string | null;
        editedHeadline?: string | null;
      }
    ): Promise<{ applied: string[] }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const insight = await repository.getInsight(input.insightId);
      if (!insight) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Insight not found.");
      }
      assertInsightBelongsToCandidate(String(insight.candidateId), input.candidateId);
      await assertCandidateManageScope(session, input.candidateId);
      if (insight.insightType !== AiInsightType.candidate_summary) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Not an enrichment insight.");
      }
      if (
        insight.status !== AiInsightStatus.pending_review &&
        insight.status !== AiInsightStatus.accepted
      ) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Insight is not reviewable.");
      }

      const parsed = parseEnrichmentInsightContent(insight.contentJson);
      if (!parsed.ok) {
        throw new RecruitmentDomainError("REC_VALIDATION", parsed.error);
      }

      const candidate = await repository.getCandidate(input.candidateId);
      if (!candidate || candidate.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      let mapped: ResumeImportMappedDraft | null = null;
      if (parsed.data.sourceDraftId) {
        const draft = await repository.getInsight(parsed.data.sourceDraftId);
        if (draft && String(draft.candidateId) === input.candidateId) {
          try {
            mapped = parseResumeImportDraftContent(draft.contentJson).mapped;
          } catch {
            mapped = null;
          }
        }
      }

      if (
        !isEnrichmentFresh({
          content: parsed.data,
          candidate,
          mapped,
        })
      ) {
        logger.warn("recruitment.ai.enrichment_accept_rejected_stale", {
          entityType: "candidate",
          entityId: input.candidateId,
          insightId: input.insightId,
          sourceDraftId: parsed.data.sourceDraftId,
        });
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          ENRICHMENT_STALE_ACCEPT_MESSAGE
        );
      }

      const patch: Record<string, unknown> = {};
      const applied: string[] = [];
      const nextApplied = { ...parsed.data.applied };

      if (input.acceptSummary) {
        const value = (input.editedSummary ?? parsed.data.enrichment.summary).trim();
        if (!value) {
          throw new RecruitmentDomainError("REC_VALIDATION", "Summary cannot be empty.");
        }
        if (isFilledText(candidate.professionalSummary) && !input.replaceSummary) {
          throw new RecruitmentDomainError(
            "REC_VALIDATION",
            "Candidate already has a professional summary. Pass replaceSummary to overwrite."
          );
        }
        patch.professionalSummary = value;
        applied.push("professionalSummary");
        nextApplied.summary = true;
      }

      if (input.acceptHeadline) {
        const value = (input.editedHeadline ?? parsed.data.enrichment.headline).trim();
        if (!value) {
          throw new RecruitmentDomainError("REC_VALIDATION", "Headline cannot be empty.");
        }
        if (isFilledText(candidate.headline) && !input.replaceHeadline) {
          throw new RecruitmentDomainError(
            "REC_VALIDATION",
            "Candidate already has a headline. Pass replaceHeadline to overwrite."
          );
        }
        patch.headline = value;
        applied.push("headline");
        nextApplied.headline = true;
      }

      if (applied.length === 0) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Select at least one field to accept."
        );
      }

      const nextContent: CandidateEnrichmentInsightContent = {
        ...parsed.data,
        applied: nextApplied,
      };

      const events = createAfterCommitBuffer();
      const actor = toRecruitmentActor(session);

      await withRecruitmentTransaction(async (tx) => {
        await repository.updateCandidate(input.candidateId, patch as never, tx);
        await tx.candidateAiInsight.update({
          where: { id: input.insightId },
          data: {
            status: AiInsightStatus.accepted,
            contentJson: nextContent,
            reviewedByUserId: session.id,
            reviewedAt: new Date(),
          },
        });
        await prismaTimelineProjectionRepository.append(
          {
            entityType: "candidate",
            entityId: input.candidateId,
            candidateId: input.candidateId,
            eventType: "candidate_ai_enrichment_accepted",
            summary: "AI enrichment fields applied to candidate",
            actorUserId: session.id,
            metadata: { insightId: input.insightId, applied },
          },
          tx
        );
        events.enqueue(
          RecruitmentEventFactory.candidateUpdated(actor, {
            candidateId: input.candidateId,
            changedFields: applied,
          })
        );
      });

      await events.flush();
      return { applied };
    },
  };
}

export type CandidateAiEnrichmentService = ReturnType<
  typeof createCandidateAiEnrichmentService
>;
