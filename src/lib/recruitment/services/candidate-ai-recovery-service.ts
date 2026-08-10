import "server-only";

import { randomUUID } from "node:crypto";
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
import { extractResumeText } from "@/lib/recruitment/resume-import/parser/extract-text";
import { getRecruitmentStorage } from "@/lib/recruitment/storage/recruitment-storage";
import { getAiRuntimeConfig } from "@/lib/recruitment/ai/config";
import { createGeminiProvider } from "@/lib/recruitment/ai/gemini-provider";
import type { AiProvider } from "@/lib/recruitment/ai/provider";
import { buildResumeFieldRecoveryContext } from "@/lib/recruitment/ai/recovery-context";
import {
  isRecoveryFieldStillEmpty,
  listEligibleRecoveryFields,
} from "@/lib/recruitment/ai/recovery-eligible";
import {
  computeRecoveryInputFingerprint,
  hashResumeText,
  recoveryFingerprintsMatch,
} from "@/lib/recruitment/ai/recovery-fingerprint";
import { parseRecoveryInsightContent } from "@/lib/recruitment/ai/recovery-schema";
import {
  RESUME_FIELD_RECOVERY_CONTENT_KIND,
  RESUME_FIELD_RECOVERY_PROMPT_VERSION,
  type RecoveryFieldKey,
  type RecoveryProposal,
  type ResumeFieldRecoveryInsightContent,
} from "@/lib/recruitment/ai/recovery-types";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import { logger } from "@/lib/observability/logger";
import { normalizeResumeDate } from "@/lib/recruitment/resume-import/parser/patterns";

export const RECOVERY_STALE_ACCEPT_MESSAGE =
  "This AI field recovery is outdated. Please regenerate it before applying.";

export const RECOVERY_FIELD_FILLED_MESSAGE =
  "One or more proposed fields were already filled. Regenerate recovery proposals.";

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

function isUniquePendingViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function sameRecoveryContext(
  content: ResumeFieldRecoveryInsightContent,
  documentId: string | null,
  sourceDraftId: string | null
): boolean {
  if (content.promptVersion !== RESUME_FIELD_RECOVERY_PROMPT_VERSION) return false;
  if (documentId && content.documentId === documentId) return true;
  if (sourceDraftId && content.sourceDraftId === sourceDraftId) return true;
  return !documentId && !sourceDraftId && !content.documentId && !content.sourceDraftId;
}

export function isRecoveryFresh(input: {
  content: ResumeFieldRecoveryInsightContent;
  candidate: CandidateDetail;
  resumeTextHash: string;
}): boolean {
  const current = computeRecoveryInputFingerprint({
    candidate: input.candidate,
    documentId: input.content.documentId,
    sourceDraftId: input.content.sourceDraftId,
    resumeTextHash: input.resumeTextHash,
  });
  return recoveryFingerprintsMatch(input.content.inputFingerprint, current);
}

async function loadResumeTextForDraft(input: {
  repository: CandidateRepository;
  candidateId: string;
  documentId: string | null;
}): Promise<string> {
  if (!input.documentId) return "";
  const doc = await input.repository.getCandidateDocument(input.documentId);
  if (!doc || String(doc.candidateId) !== input.candidateId) return "";
  const storageKey = String(doc.storageKey ?? "");
  if (!storageKey) return "";
  const storage = getRecruitmentStorage();
  if (!(await storage.exists(storageKey))) return "";
  const bytes = await storage.read(storageKey);
  const extracted = await extractResumeText({
    content: bytes,
    fileName: String(doc.fileName ?? "resume.pdf"),
    mimeType: String(doc.mimeType ?? "application/pdf"),
  });
  return extracted.ok ? extracted.extraction.text : "";
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const normalized = normalizeResumeDate(value);
  if (!normalized) return null;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function createCandidateAiRecoveryService(
  repository: CandidateRepository = prismaCandidateRepository,
  provider: AiProvider = createGeminiProvider()
) {
  return {
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
          error: err instanceof Error ? err.message : "AI field recovery failed.",
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
    }): Promise<{ insightId: string; reused?: boolean; skipped?: string }> {
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
      const eligibleFields = listEligibleRecoveryFields(candidate);
      if (eligibleFields.length === 0) {
        logger.info("recruitment.ai.recovery_skipped", {
          entityType: "candidate",
          entityId: input.candidateId,
          sourceDraftId: input.sourceDraftId,
          reason: "no_eligible_empty_fields",
        });
        return { insightId: "", skipped: "No eligible empty fields." };
      }

      const resumeText = await loadResumeTextForDraft({
        repository,
        candidateId: input.candidateId,
        documentId,
      });
      if (!resumeText.trim()) {
        return { insightId: "", skipped: "No resume text available for recovery." };
      }

      const resumeTextHash = hashResumeText(resumeText);
      const inputFingerprint = computeRecoveryInputFingerprint({
        candidate,
        documentId,
        sourceDraftId: input.sourceDraftId,
        resumeTextHash,
      });

      const findReusable = async (): Promise<string | null> => {
        const existing = await repository.listInsights(input.candidateId, {
          insightType: AiInsightType.resume_field_recovery,
        });
        for (const row of existing) {
          if (row.status !== AiInsightStatus.pending_review) continue;
          const parsed = parseRecoveryInsightContent(row.contentJson);
          if (!parsed.ok) continue;
          if (!sameRecoveryContext(parsed.data, documentId, input.sourceDraftId)) {
            continue;
          }
          if (
            !recoveryFingerprintsMatch(parsed.data.inputFingerprint, inputFingerprint)
          ) {
            continue;
          }
          return String(row.id);
        }
        return null;
      };

      if (!input.force) {
        const reusableId = await findReusable();
        if (reusableId) {
          logger.info("recruitment.ai.recovery_reused", {
            entityType: "candidate",
            entityId: input.candidateId,
            insightId: reusableId,
            sourceDraftId: input.sourceDraftId,
          });
          return { insightId: reusableId, reused: true };
        }
      }

      const context = buildResumeFieldRecoveryContext({
        candidate,
        resumeText,
        eligibleFields,
      });
      const generated = await provider.generateResumeFieldRecovery(context);
      if (!generated.ok) {
        logger.warn("recruitment.ai.recovery.provider_failed", {
          entityType: "candidate",
          entityId: input.candidateId,
          sourceDraftId: input.sourceDraftId,
          reason: generated.error,
        });
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          `AI field recovery failed: ${generated.error}`
        );
      }

      const eligibleSet = new Set(eligibleFields);
      const filtered = generated.data.filter((row) => eligibleSet.has(row.field));
      if (filtered.length === 0) {
        return { insightId: "", skipped: "No recovery proposals returned." };
      }

      const proposals: RecoveryProposal[] = filtered.map((row) => ({
        id: randomUUID(),
        field: row.field,
        value: row.value,
        confidence: row.confidence,
        evidence: row.evidence,
        applied: false,
      }));

      const content: ResumeFieldRecoveryInsightContent = {
        version: 1,
        kind: RESUME_FIELD_RECOVERY_CONTENT_KIND,
        promptVersion: RESUME_FIELD_RECOVERY_PROMPT_VERSION,
        documentId,
        sourceDraftId: input.sourceDraftId,
        inputFingerprint,
        resumeTextHash,
        eligibleFields,
        proposals,
      };

      const events = createAfterCommitBuffer();
      try {
        const insightId = await withRecruitmentTransaction(async (tx) => {
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtext(${`ai-recovery:${input.candidateId}`})
            )
          `;

          if (!input.force) {
            const reusableId = await findReusable();
            if (reusableId) return { id: reusableId, reused: true as const };
          }

          const pending = await repository.listInsights(input.candidateId, {
            insightType: AiInsightType.resume_field_recovery,
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
            logger.info("recruitment.ai.recovery_superseded", {
              entityType: "candidate",
              entityId: input.candidateId,
              insightId: String(row.id),
              sourceDraftId: input.sourceDraftId,
            });
          }

          const { id } = await repository.createInsight(
            input.candidateId,
            {
              insightType: AiInsightType.resume_field_recovery,
              status: AiInsightStatus.pending_review,
              title: "AI resume field recovery",
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
              eventType: "candidate_ai_recovery_created",
              summary: "AI resume field recovery generated",
              actorUserId: input.createdByUserId ?? input.session?.id ?? null,
              metadata: {
                insightId: id,
                documentId,
                sourceDraftId: input.sourceDraftId,
                proposalCount: proposals.length,
              },
            },
            tx
          );

          if (input.session) {
            const actor = toRecruitmentActor(input.session);
            events.enqueue(
              RecruitmentEventFactory.candidateUpdated(actor, {
                candidateId: input.candidateId,
                changedFields: ["aiFieldRecovery"],
              })
            );
          }

          return { id, reused: false as const };
        });

        await events.flush();
        if (insightId.reused) {
          return { insightId: insightId.id, reused: true };
        }
        logger.info("recruitment.ai.recovery_generated", {
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
            return { insightId: reusableId, reused: true };
          }
          if (!input.force) {
            return this.generateFromResumeDraft({ ...input, force: true });
          }
        }
        throw error;
      }
    },

    async listLatestRecovery(candidateId: string): Promise<{
      insight: Record<string, unknown> | null;
      content: ResumeFieldRecoveryInsightContent | null;
    }> {
      const rows = await repository.listInsights(candidateId, {
        insightType: AiInsightType.resume_field_recovery,
      });
      for (const row of rows) {
        if (
          row.status !== AiInsightStatus.pending_review &&
          row.status !== AiInsightStatus.accepted
        ) {
          continue;
        }
        const parsed = parseRecoveryInsightContent(row.contentJson);
        if (!parsed.ok) continue;
        return { insight: row, content: parsed.data };
      }
      return { insight: null, content: null };
    },

    async dismissRecovery(
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
      if (insight.insightType !== AiInsightType.resume_field_recovery) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Not a recovery insight.");
      }
      if (insight.status !== AiInsightStatus.pending_review) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only pending recovery insights can be dismissed."
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
            eventType: "candidate_ai_recovery_dismissed",
            summary: "AI resume field recovery dismissed",
            actorUserId: session.id,
            metadata: { insightId: input.insightId },
          },
          tx
        );
      });
    },

    async acceptRecoveryProposals(
      session: SessionUser,
      input: {
        insightId: string;
        candidateId: string;
        proposalIds: string[];
        editedValues?: Record<string, unknown>;
      }
    ): Promise<{ applied: string[]; skipped: string[] }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const insight = await repository.getInsight(input.insightId);
      if (!insight) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Insight not found.");
      }
      assertInsightBelongsToCandidate(String(insight.candidateId), input.candidateId);
      await assertCandidateManageScope(session, input.candidateId);
      if (insight.insightType !== AiInsightType.resume_field_recovery) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Not a recovery insight.");
      }
      if (
        insight.status !== AiInsightStatus.pending_review &&
        insight.status !== AiInsightStatus.accepted
      ) {
        throw new RecruitmentDomainError("REC_VALIDATION", "Insight is not reviewable.");
      }

      const parsed = parseRecoveryInsightContent(insight.contentJson);
      if (!parsed.ok) {
        throw new RecruitmentDomainError("REC_VALIDATION", parsed.error);
      }

      const candidate = await repository.getCandidate(input.candidateId);
      if (!candidate || candidate.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      const resumeText = await loadResumeTextForDraft({
        repository,
        candidateId: input.candidateId,
        documentId: parsed.data.documentId,
      });
      const resumeTextHash = hashResumeText(resumeText);
      if (
        !isRecoveryFresh({
          content: parsed.data,
          candidate,
          resumeTextHash,
        })
      ) {
        logger.warn("recruitment.ai.recovery_accept_rejected_stale", {
          entityType: "candidate",
          entityId: input.candidateId,
          insightId: input.insightId,
        });
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          RECOVERY_STALE_ACCEPT_MESSAGE
        );
      }

      if (input.proposalIds.length === 0) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Select at least one recovery proposal to accept."
        );
      }

      const byId = new Map(parsed.data.proposals.map((p) => [p.id, p]));
      const applied: string[] = [];
      const skipped: string[] = [];
      const nextProposals = parsed.data.proposals.map((p) => ({ ...p }));

      const events = createAfterCommitBuffer();
      const actor = toRecruitmentActor(session);

      await withRecruitmentTransaction(async (tx) => {
        for (const proposalId of input.proposalIds) {
          const proposal = byId.get(proposalId);
          if (!proposal || proposal.applied) {
            skipped.push(proposalId);
            continue;
          }

          if (!isRecoveryFieldStillEmpty(candidate, proposal.field)) {
            skipped.push(proposal.field);
            continue;
          }

          const value =
            input.editedValues && proposalId in input.editedValues
              ? input.editedValues[proposalId]
              : proposal.value;

          await applyRecoveryValue({
            repository,
            candidateId: input.candidateId,
            field: proposal.field,
            value,
            tx,
          });

          const idx = nextProposals.findIndex((p) => p.id === proposalId);
          if (idx >= 0) nextProposals[idx] = { ...nextProposals[idx]!, applied: true };
          applied.push(proposal.field);
        }

        if (applied.length === 0) {
          throw new RecruitmentDomainError(
            "REC_VALIDATION",
            RECOVERY_FIELD_FILLED_MESSAGE
          );
        }

        const nextContent: ResumeFieldRecoveryInsightContent = {
          ...parsed.data,
          proposals: nextProposals,
        };

        await tx.candidateAiInsight.update({
          where: { id: input.insightId },
          data: {
            status: AiInsightStatus.accepted,
            contentJson: nextContent as unknown as Prisma.InputJsonValue,
            reviewedByUserId: session.id,
            reviewedAt: new Date(),
          },
        });

        await prismaTimelineProjectionRepository.append(
          {
            entityType: "candidate",
            entityId: input.candidateId,
            candidateId: input.candidateId,
            eventType: "candidate_ai_recovery_accepted",
            summary: "AI resume field recovery applied",
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
      return { applied, skipped };
    },
  };
}

async function applyRecoveryValue(input: {
  repository: CandidateRepository;
  candidateId: string;
  field: RecoveryFieldKey;
  value: unknown;
  tx: Parameters<CandidateRepository["updateCandidate"]>[2];
}): Promise<void> {
  const { repository, candidateId, field, value, tx } = input;

  if (field === "location") {
    await repository.updateCandidate(
      candidateId,
      { location: String(value) } as never,
      tx
    );
    return;
  }
  if (field === "headline") {
    await repository.updateCandidate(
      candidateId,
      { headline: String(value) } as never,
      tx
    );
    return;
  }
  if (field === "professionalSummary") {
    await repository.updateCandidate(
      candidateId,
      { professionalSummary: String(value) } as never,
      tx
    );
    return;
  }
  if (field === "githubUrl") {
    await repository.updateCandidate(
      candidateId,
      { githubUrl: String(value) } as never,
      tx
    );
    return;
  }
  if (field === "linkedinUrl") {
    await repository.updateCandidate(
      candidateId,
      { linkedinUrl: String(value) } as never,
      tx
    );
    return;
  }
  if (field === "portfolioUrl") {
    const candidate = await repository.getCandidate(candidateId);
    await repository.updateCandidate(
      candidateId,
      {
        personal: {
          nationality: candidate?.personal?.nationality ?? null,
          currentLocation: candidate?.personal?.currentLocation ?? null,
          preferredLocation: candidate?.personal?.preferredLocation ?? null,
          noticePeriod: candidate?.personal?.noticePeriod ?? null,
          availabilityDate: candidate?.personal?.availabilityDate ?? null,
          linkedinUrl: candidate?.personal?.linkedinUrl ?? null,
          portfolioUrl: String(value),
        },
      } as never,
      tx
    );
    return;
  }
  if (field === "skill") {
    await repository.upsertSkill(
      candidateId,
      { name: String(value), skillName: String(value) },
      tx
    );
    return;
  }
  if (field === "experience") {
    const row = value as {
      company: string;
      title: string;
      location?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      isCurrent?: boolean;
      description?: string | null;
    };
    await repository.upsertExperience(
      candidateId,
      {
        company: row.company,
        title: row.title,
        location: row.location ?? null,
        startDate: parseOptionalDate(row.startDate ?? null),
        endDate: parseOptionalDate(row.endDate ?? null),
        isCurrent: Boolean(row.isCurrent),
        description: row.description ?? null,
      },
      tx
    );
    return;
  }
  if (field === "education") {
    const row = value as {
      institution: string;
      degree?: string | null;
      field?: string | null;
      startYear?: number | null;
      endYear?: number | null;
      grade?: string | null;
    };
    await repository.upsertEducation(
      candidateId,
      {
        institution: row.institution,
        degree: row.degree ?? null,
        field: row.field ?? null,
        fieldOfStudy: row.field ?? null,
        startYear: row.startYear ?? null,
        endYear: row.endYear ?? null,
        grade: row.grade ?? null,
      },
      tx
    );
    return;
  }
  if (field === "project") {
    const row = value as {
      title: string;
      summary?: string | null;
      techStack?: string | null;
      url?: string | null;
      duration?: string | null;
    };
    await repository.upsertProject(
      candidateId,
      {
        title: row.title,
        summary: row.summary ?? null,
        techStack: row.techStack ?? null,
        url: row.url ?? null,
        duration: row.duration ?? null,
      },
      tx
    );
    return;
  }
  if (field === "certification") {
    const row = value as {
      name: string;
      issuer?: string | null;
      issuedAt?: string | null;
      credentialId?: string | null;
      credentialUrl?: string | null;
    };
    await repository.upsertCertification(
      candidateId,
      {
        name: row.name,
        issuer: row.issuer ?? null,
        issuedAt: parseOptionalDate(row.issuedAt ?? null),
        credentialId: row.credentialId ?? null,
        credentialUrl: row.credentialUrl ?? null,
      },
      tx
    );
  }
}

export type CandidateAiRecoveryService = ReturnType<
  typeof createCandidateAiRecoveryService
>;
