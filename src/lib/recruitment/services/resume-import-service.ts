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
  buildResumeMergeResult,
  resolveConflictSelections,
  resumeMergeHasWork,
  RESUME_IMPORT_DENIED_SCALAR_KEYS,
  type ResumeImportApplyInput,
  type ResumeImportDraftContent,
  type ResumeImportMappedDraft,
  type ResumeMergeResult,
  type ScalarFieldDiff,
  type SectionDiff,
} from "@/lib/recruitment/resume-import";
import { parseResumeDocument } from "@/lib/recruitment/resume-import/parser";
import { getRecruitmentStorage } from "@/lib/recruitment/storage/recruitment-storage";
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

export type ResumeMergePreview = {
  draftId: string;
  candidateId: string;
  documentId: string;
  merge: ResumeMergeResult;
  hasWork: boolean;
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

      let content: ResumeImportDraftContent;
      if (input.content) {
        content = input.content;
      } else if (input.documentId) {
        // Real parser path — Document → extract → parse → normalize → draft
        const doc = await repository.getCandidateDocument(input.documentId);
        if (!doc) {
          throw new RecruitmentDomainError(
            "REC_NOT_FOUND",
            "Resume document not found for this candidate."
          );
        }
        const storage = getRecruitmentStorage();
        const storageKey = String(doc.storageKey ?? "");
        if (!storageKey || !(await storage.exists(storageKey))) {
          throw new RecruitmentDomainError(
            "REC_NOT_FOUND",
            "Resume file not found in storage."
          );
        }
        const fileBytes = await storage.read(storageKey);
        const { draftContent } = await parseResumeDocument({
          content: fileBytes,
          fileName: String(doc.fileName ?? "resume.pdf"),
          mimeType: String(doc.mimeType ?? "application/octet-stream"),
          documentId: input.documentId,
        });
        content = draftContent;
      } else {
        // No document: keep stub for backward-compatible draft-only flows / tests.
        content = buildStubResumeImportContent({
          documentId: null,
          candidateHint: {
            fullName: candidate.fullName,
            email: candidate.email,
          },
        });
      }

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
            title:
              content.source === "parser"
                ? "Resume import draft"
                : content.documentId
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

    /**
     * V1 profile enrich: upload → stub/parser draft → merge plan (no profile write yet).
     */
    async prepareMerge(
      session: SessionUser,
      input: { candidateId: string; documentId: string }
    ): Promise<ResumeMergePreview> {
      const { id: draftId } = await this.createDraft(session, {
        candidateId: input.candidateId,
        documentId: input.documentId,
      });

      const candidate = await repository.getCandidate(input.candidateId);
      if (!candidate) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Candidate not found.");
      }

      const insight = await repository.getInsight(draftId);
      if (!insight) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Import draft not found.");
      }

      const content = parseResumeImportDraftContent(insight.contentJson);
      const merge = buildResumeMergeResult(candidate, content.mapped);

      return {
        draftId,
        candidateId: input.candidateId,
        documentId: input.documentId,
        merge,
        hasWork: resumeMergeHasWork(merge),
      };
    },

    /**
     * V1 apply: auto-fill empty fields + HR conflict choices + append-only lists.
     * Never replaces or deletes existing profile rows.
     */
    async applyMerge(
      session: SessionUser,
      input: {
        draftId: string;
        candidateId: string;
        conflictSelections: Record<string, "current" | "parsed">;
      }
    ): Promise<{ appliedFields: string[]; appended: string[] }> {
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
      const merge = buildResumeMergeResult(candidate, content.mapped);

      for (const conflict of merge.conflicts) {
        const choice = input.conflictSelections[conflict.key];
        if (choice !== "current" && choice !== "parsed") {
          throw new RecruitmentDomainError(
            "REC_VALIDATION",
            `Resolve conflict for "${conflict.label}" before applying.`
          );
        }
      }

      const resolvedConflicts = resolveConflictSelections(
        merge.conflicts,
        input.conflictSelections
      );
      const scalarPatch: Record<string, unknown> = {
        ...merge.autoFill,
        ...resolvedConflicts,
      };

      for (const key of Object.keys(scalarPatch)) {
        if (DENIED.has(key)) {
          throw new RecruitmentDomainError(
            "REC_VALIDATION",
            `Field "${key}" cannot be imported.`
          );
        }
      }

      let portfolioUrl: string | null | undefined;
      if (Object.prototype.hasOwnProperty.call(scalarPatch, PORTFOLIO_KEY)) {
        const value = scalarPatch[PORTFOLIO_KEY];
        portfolioUrl =
          value === null || value === undefined ? null : String(value);
        delete scalarPatch[PORTFOLIO_KEY];
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

      const appliedFields = Object.keys(scalarPatch).filter(
        (k) => k !== "normalizedEmail" && k !== "normalizedPhone" && k !== "personal"
      );
      if (portfolioUrl !== undefined) appliedFields.push(PORTFOLIO_KEY);

      const appended: string[] = [];
      const hasScalarWork = Object.keys(scalarPatch).length > 0;
      const hasAppendWork =
        merge.experiencesToAppend.length > 0 ||
        merge.educationsToAppend.length > 0 ||
        merge.skillsToAppend.length > 0 ||
        merge.projectsToAppend.length > 0 ||
        merge.certificationsToAppend.length > 0;

      if (!hasScalarWork && !hasAppendWork) {
        // Mark draft accepted with no profile changes (nothing useful to merge).
        await withRecruitmentTransaction(async (tx) => {
          await repository.updateInsightStatus(
            input.draftId,
            AiInsightStatus.accepted,
            tx,
            { reviewedByUserId: session.id, reviewedAt: new Date() }
          );
        });
        return { appliedFields: [], appended: [] };
      }

      const events = createAfterCommitBuffer();
      await withRecruitmentTransaction(async (tx) => {
        if (hasScalarWork) {
          await repository.updateCandidate(candidateId, scalarPatch as never, tx);
        }

        for (const row of merge.experiencesToAppend) {
          await repository.upsertExperience(
            candidateId,
            row as unknown as Record<string, unknown>,
            tx
          );
          appended.push("experience");
        }
        for (const row of merge.educationsToAppend) {
          await repository.upsertEducation(
            candidateId,
            row as unknown as Record<string, unknown>,
            tx
          );
          appended.push("education");
        }
        for (const row of merge.skillsToAppend) {
          await repository.upsertSkill(
            candidateId,
            row as unknown as Record<string, unknown>,
            tx
          );
          appended.push("skill");
        }
        for (const row of merge.projectsToAppend) {
          await repository.upsertProject(
            candidateId,
            row as unknown as Record<string, unknown>,
            tx
          );
          appended.push("project");
        }
        for (const row of merge.certificationsToAppend) {
          await repository.upsertCertification(
            candidateId,
            row as unknown as Record<string, unknown>,
            tx
          );
          appended.push("certification");
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
            eventType: "resume_import_merged",
            summary: "Resume merged into candidate profile",
            actorUserId: session.id,
            metadata: {
              draftId: input.draftId,
              appliedFields,
              appendedExperiences: merge.experiencesToAppend.length,
              appendedEducations: merge.educationsToAppend.length,
              appendedSkills: merge.skillsToAppend.length,
              appendedProjects: merge.projectsToAppend.length,
              appendedCertifications: merge.certificationsToAppend.length,
            },
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.candidateUpdated(actor, {
            candidateId,
            changedFields: [
              ...appliedFields,
              ...(merge.experiencesToAppend.length > 0 ? ["section:experiences"] : []),
              ...(merge.educationsToAppend.length > 0 ? ["section:educations"] : []),
              ...(merge.skillsToAppend.length > 0 ? ["section:skills"] : []),
              ...(merge.projectsToAppend.length > 0 ? ["section:projects"] : []),
              ...(merge.certificationsToAppend.length > 0
                ? ["section:certifications"]
                : []),
            ],
          })
        );
      });

      await events.flush();
      return { appliedFields, appended };
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
