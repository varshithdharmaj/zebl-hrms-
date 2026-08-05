import { AiInsightStatus, AiInsightType } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { prismaCandidateRepository } from "@/lib/recruitment/repositories/prisma-candidate-repository";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import {
  buildResumeImportDiffs,
  buildStubResumeImportContent,
  parseResumeImportDraftContent,
  RESUME_IMPORT_DENIED_SCALAR_KEYS,
  type ResumeImportApplyInput,
  type ResumeImportDraftContent,
  type ResumeImportMappedDraft,
  type ScalarFieldDiff,
  type SectionDiff,
} from "@/lib/recruitment/resume-import";
import {
  normalizeEmail,
  normalizePhone,
} from "@/lib/recruitment/candidate/candidate-normalizer";

const PERSONAL_KEYS = new Set([
  "fullName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "location",
]);

const PROFESSIONAL_KEYS = new Set([
  "headline",
  "professionalSummary",
  "currentCompany",
  "currentTitle",
  "githubUrl",
  "linkedinUrl",
  "totalExperienceYears",
  "preferredWorkMode",
  "willingToRelocate",
]);

const PORTFOLIO_KEY = "portfolioUrl";

const DENIED = new Set<string>(RESUME_IMPORT_DENIED_SCALAR_KEYS);

async function assertCandidateManageScope(
  session: SessionUser,
  candidateId: string
): Promise<void> {
  const scope = await RecruitmentScopeEngine.getScope(session);
  RecruitmentScopeEngine.assertCandidateInScope(scope, candidateId);
}

function averageConfidence(content: ResumeImportDraftContent): number | null {
  const values = Object.values(content.fieldConfidence).filter(
    (n) => typeof n === "number" && Number.isFinite(n)
  );
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function resolveImportedScalar(
  mapped: ResumeImportMappedDraft,
  key: string
): unknown {
  if (PERSONAL_KEYS.has(key)) {
    return mapped.personal[key as keyof typeof mapped.personal];
  }
  if (key === PORTFOLIO_KEY || PROFESSIONAL_KEYS.has(key)) {
    return mapped.professional[key as keyof typeof mapped.professional];
  }
  return undefined;
}

function sectionRowsFromMapped(
  mapped: ResumeImportMappedDraft,
  section: string
): Record<string, unknown>[] {
  switch (section) {
    case "experiences":
      return mapped.experiences as unknown as Record<string, unknown>[];
    case "educations":
      return mapped.educations as unknown as Record<string, unknown>[];
    case "skills":
      return mapped.skills as unknown as Record<string, unknown>[];
    case "projects":
      return mapped.projects as unknown as Record<string, unknown>[];
    case "certifications":
      return mapped.certifications as unknown as Record<string, unknown>[];
    default:
      return [];
  }
}

export type ResumeImportReviewView = {
  draftId: string;
  candidateId: string;
  status: string;
  title: string | null;
  confidence: number | null;
  content: ResumeImportDraftContent;
  scalars: ScalarFieldDiff[];
  sections: SectionDiff[];
  candidate: CandidateDetail;
};

/**
 * Resume import review buffer + apply.
 * Future parsers: build ResumeImportDraftContent and call createDraft().
 */
export function createResumeImportService(
  repository: CandidateRepository = prismaCandidateRepository
) {
  return {
    /**
     * Create a pending_review CandidateAiInsight(resume_parse).
     * Pass `content` from a future parser, or omit to use Phase 1 stub.
     */
    async createDraft(
      session: SessionUser,
      input: {
        candidateId: string;
        documentId?: string | null;
        content?: ResumeImportDraftContent;
      }
    ): Promise<{ id: string }> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      await assertCandidateManageScope(session, input.candidateId);
      const actor = toRecruitmentActor(session);

      const candidate = await repository.getCandidate(input.candidateId);
      if (!candidate || candidate.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      if (input.documentId) {
        const doc = await repository.getCandidateDocument(input.documentId);
        if (!doc || doc.candidateId !== input.candidateId || doc.deletedAt) {
          throw new RecruitmentDomainError(
            "REC_NOT_FOUND",
            "Resume document not found for this candidate."
          );
        }
      }

      const content =
        input.content ??
        buildStubResumeImportContent({
          documentId: input.documentId ?? null,
          candidateHint: {
            fullName: candidate.fullName,
            email: candidate.email,
          },
        });

      if (input.documentId && !content.documentId) {
        content.documentId = input.documentId;
      }

      parseResumeImportDraftContent(content);

      const events = createAfterCommitBuffer();
      const draftId = await withRecruitmentTransaction(async (tx) => {
        if (content.documentId) {
          const pending = await repository.listInsights(input.candidateId, {
            insightType: AiInsightType.resume_parse,
            status: AiInsightStatus.pending_review,
          });
          for (const row of pending) {
            const existing = parseResumeImportDraftContent(row.contentJson);
            if (existing.documentId === content.documentId) {
              await repository.updateInsightStatus(
                String(row.id),
                AiInsightStatus.superseded,
                tx,
                { reviewedByUserId: session.id, reviewedAt: new Date() }
              );
            }
          }
        }

        const { id } = await repository.createInsight(
          input.candidateId,
          {
            insightType: AiInsightType.resume_parse,
            status: AiInsightStatus.pending_review,
            title: content.documentId
              ? "Resume import draft"
              : "Resume import draft (stub)",
            contentJson: content,
            confidence: averageConfidence(content),
            modelId: content.metadata.parserVersion ?? content.source,
            createdByUserId: session.id,
          },
          tx
        );

        await RecruitmentTimelineService.append(
          {
            entityType: "candidate",
            entityId: input.candidateId,
            candidateId: input.candidateId,
            eventType: "resume_import_draft_created",
            summary: "Resume import draft created",
            actorUserId: session.id,
            metadata: {
              draftId: id,
              documentId: content.documentId,
              source: content.source,
              // Never store resume text in timeline metadata.
            },
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.candidateUpdated(actor, {
            candidateId: input.candidateId,
            changedFields: ["resumeImportDraft"],
          })
        );

        return id;
      });

      await events.flush();
      return { id: draftId };
    },

    async getReview(
      session: SessionUser,
      draftId: string
    ): Promise<ResumeImportReviewView> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const insight = await repository.getInsight(draftId);
      if (!insight) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Import draft not found.");
      }
      if (insight.insightType !== AiInsightType.resume_parse) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Insight is not a resume import draft."
        );
      }

      const candidateId = String(insight.candidateId);
      await assertCandidateManageScope(session, candidateId);

      const candidate = await repository.getCandidate(candidateId);
      if (!candidate) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      const content = parseResumeImportDraftContent(insight.contentJson);
      const { scalars, sections } = buildResumeImportDiffs(candidate, content);

      return {
        draftId: String(insight.id),
        candidateId,
        status: String(insight.status),
        title: (insight.title as string | null) ?? null,
        confidence:
          typeof insight.confidence === "number" ? insight.confidence : null,
        content,
        scalars,
        sections,
        candidate,
      };
    },

    async dismissDraft(session: SessionUser, draftId: string): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const insight = await repository.getInsight(draftId);
      if (!insight) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Import draft not found.");
      }
      if (insight.insightType !== AiInsightType.resume_parse) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Insight is not a resume import draft."
        );
      }
      if (insight.status !== AiInsightStatus.pending_review) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only pending import drafts can be dismissed."
        );
      }

      const candidateId = String(insight.candidateId);
      await assertCandidateManageScope(session, candidateId);

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        await repository.updateInsightStatus(
          draftId,
          AiInsightStatus.dismissed,
          tx,
          { reviewedByUserId: session.id, reviewedAt: new Date() }
        );

        await RecruitmentTimelineService.append(
          {
            entityType: "candidate",
            entityId: candidateId,
            candidateId,
            eventType: "resume_import_dismissed",
            summary: "Resume import draft dismissed",
            actorUserId: session.id,
            metadata: { draftId },
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.candidateUpdated(actor, {
            candidateId,
            changedFields: ["resumeImportDismissed"],
          })
        );
      });

      await events.flush();
    },

    async applyDraft(
      session: SessionUser,
      input: ResumeImportApplyInput
    ): Promise<void> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);
      const actor = toRecruitmentActor(session);

      const insight = await repository.getInsight(input.draftId);
      if (!insight) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Import draft not found.");
      }
      if (insight.insightType !== AiInsightType.resume_parse) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Insight is not a resume import draft."
        );
      }
      if (insight.status !== AiInsightStatus.pending_review) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Only pending import drafts can be applied."
        );
      }

      const candidateId = String(insight.candidateId);
      if (candidateId !== input.candidateId) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Draft does not belong to this candidate."
        );
      }
      await assertCandidateManageScope(session, candidateId);

      const candidate = await repository.getCandidate(candidateId);
      if (!candidate) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      const content = parseResumeImportDraftContent(insight.contentJson);
      const acceptedKeys = new Set(
        input.scalarDecisions
          .filter((d) => d.action === "accept")
          .map((d) => d.key)
      );

      for (const key of acceptedKeys) {
        if (DENIED.has(key)) {
          throw new RecruitmentDomainError(
            "REC_VALIDATION",
            `Field "${key}" cannot be imported.`
          );
        }
      }

      const scalarPatch: Record<string, unknown> = {};
      let portfolioUrl: string | null | undefined;
      const decisionByKey = new Map(
        input.scalarDecisions.map((d) => [d.key, d] as const)
      );

      for (const [key, decision] of decisionByKey) {
        if (decision.action !== "accept") continue;
        if (DENIED.has(key)) continue;

        const value =
          decision.editedValue !== undefined
            ? decision.editedValue
            : resolveImportedScalar(content.mapped, key);

        if (key === PORTFOLIO_KEY) {
          portfolioUrl =
            value === null || value === undefined ? null : String(value);
          continue;
        }
        if (PERSONAL_KEYS.has(key) || PROFESSIONAL_KEYS.has(key)) {
          scalarPatch[key] = value ?? null;
        }
      }

      if (scalarPatch.email !== undefined) {
        const normalizedEmail = normalizeEmail(
          scalarPatch.email as string | null | undefined
        );
        if (normalizedEmail && normalizedEmail !== candidate.normalizedEmail) {
          const clash = await repository.findByNormalizedEmail(normalizedEmail);
          if (clash && clash.id !== candidateId) {
            throw new RecruitmentDomainError(
              "REC_CONFLICT",
              "Imported email belongs to another candidate.",
              { duplicateCandidateId: clash.id }
            );
          }
        }
        scalarPatch.normalizedEmail = normalizedEmail;
      }

      if (scalarPatch.phone !== undefined) {
        const normalizedPhone = normalizePhone(
          scalarPatch.phone as string | null | undefined
        );
        if (normalizedPhone && normalizedPhone !== candidate.normalizedPhone) {
          const clash = await repository.findByNormalizedPhone(normalizedPhone);
          if (clash && clash.id !== candidateId) {
            throw new RecruitmentDomainError(
              "REC_CONFLICT",
              "Imported phone belongs to another candidate.",
              { duplicateCandidateId: clash.id }
            );
          }
        }
        scalarPatch.normalizedPhone = normalizedPhone;
      }

      if (portfolioUrl !== undefined) {
        scalarPatch.personal = {
          nationality: candidate.personal?.nationality ?? null,
          currentLocation: candidate.personal?.currentLocation ?? null,
          preferredLocation: candidate.personal?.preferredLocation ?? null,
          noticePeriod: candidate.personal?.noticePeriod ?? null,
          availabilityDate: candidate.personal?.availabilityDate ?? null,
          linkedinUrl: candidate.personal?.linkedinUrl ?? null,
          portfolioUrl,
        };
      }

      const acceptedSections = input.sectionDecisions.filter(
        (d) => d.action === "accept"
      );

      const acceptedFieldKeys = [...acceptedKeys];
      const acceptedSectionNames = acceptedSections.map((s) => s.section);

      if (acceptedFieldKeys.length === 0 && acceptedSections.length === 0) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          "Select at least one field or section to accept before applying."
        );
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        if (Object.keys(scalarPatch).length > 0) {
          await repository.updateCandidate(candidateId, scalarPatch as never, tx);
        }

        for (const sectionDecision of acceptedSections) {
          const rows =
            sectionDecision.editedRows ??
            sectionRowsFromMapped(content.mapped, sectionDecision.section);
          await repository.replaceSection(
            candidateId,
            sectionDecision.section,
            rows,
            tx
          );
        }

        await repository.updateInsightStatus(
          input.draftId,
          AiInsightStatus.accepted,
          tx,
          { reviewedByUserId: session.id, reviewedAt: new Date() }
        );

        await RecruitmentTimelineService.append(
          {
            entityType: "candidate",
            entityId: candidateId,
            candidateId,
            eventType: "resume_import_applied",
            summary: "Resume import applied",
            actorUserId: session.id,
            metadata: {
              draftId: input.draftId,
              acceptedFields: acceptedFieldKeys,
              acceptedSections: acceptedSectionNames,
            },
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.candidateUpdated(actor, {
            candidateId,
            changedFields: [
              ...acceptedFieldKeys,
              ...acceptedSectionNames.map((s) => `section:${s}`),
            ],
          })
        );
      });

      await events.flush();
    },
  };
}
