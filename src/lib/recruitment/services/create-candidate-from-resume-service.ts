import "server-only";

import { createHash } from "node:crypto";
import {
  AiInsightStatus,
  AiInsightType,
  CandidateSource,
  CandidateStatus,
  IntakeItemStatus,
  RecruitmentDocumentType,
} from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import { RecruitmentPermissionService } from "@/lib/recruitment/permissions/permission-service";
import { prismaCandidateRepository } from "@/lib/recruitment/repositories/prisma-candidate-repository";
import type { CandidateRepository } from "@/lib/recruitment/repositories/candidate-repository";
import { prismaTimelineProjectionRepository } from "@/lib/recruitment/repositories/prisma-timeline-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import { parseResumeWithLlm } from "@/lib/recruitment/resume-import/parser/llm-parse-resume";
import { parseResumeImportDraftContent } from "@/lib/recruitment/resume-import/draft-content";
import { RESUME_IMPORT_DENIED_SCALAR_KEYS } from "@/lib/recruitment/resume-import/types";
import type {
  ResumeImportAiInsights,
  ResumeImportDraftContent,
  ResumeImportExtractionMeta,
  ResumeImportMappedDraft,
} from "@/lib/recruitment/resume-import/types";
import {
  buildCandidateDocumentStorageKey,
  buildIntakeResumeStorageKey,
  isSafeIntakeResumeKey,
} from "@/lib/recruitment/shared/storage-paths";
import { getRecruitmentStorage } from "@/lib/recruitment/storage/recruitment-storage";
import type { StorageAdapter } from "@/lib/recruitment/storage/types";
import { createCandidateFromResumeReviewSchema } from "@/lib/validation/schemas/recruitment/new-candidate-resume";
import type { CandidateCreateData } from "@/lib/recruitment/candidate/types";
import { normalizePhone as normalizePhoneLoose } from "@/lib/recruitment/resume-import/parser/patterns";
import { RESUME_UPLOAD_MAX_BYTES } from "@/lib/recruitment/resume-import/file-validation";
import { logger } from "@/lib/observability/logger";

const DENIED = new Set<string>(RESUME_IMPORT_DENIED_SCALAR_KEYS);

export const RESUME_ATTACH_FAILURE_MESSAGE =
  "The candidate was created, but the resume could not be attached. Open Documents to upload it again.";

export type NewCandidateResumeReviewDraft = {
  intakeId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  warnings: string[];
  parseOk: boolean;
  errorNote?: string;
  mapped: ResumeImportMappedDraft;
  aiInsights: ResumeImportAiInsights | null;
  extractionMeta: ResumeImportExtractionMeta | null;
};

export type CreateCandidateFromResumeResult = {
  candidateId: string;
  sourceDraftId: string;
  resumeAttached: boolean;
  resumeAttachmentError?: string;
};

type IntakePayload = {
  kind: "new_candidate_resume_v1";
  draftContent: ResumeImportDraftContent;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
};

function checksumBuffer(content: Buffer | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function assertResumeUploadMeta(fileName: string, sizeBytes: number): void {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "Only PDF or DOCX resumes are supported."
    );
  }
  if (sizeBytes <= 0) {
    throw new RecruitmentDomainError("REC_VALIDATION", "The selected file is empty.");
  }
  if (sizeBytes > RESUME_UPLOAD_MAX_BYTES) {
    throw new RecruitmentDomainError(
      "REC_VALIDATION",
      "File is too large. Maximum size is 10 MB."
    );
  }
}

function sanitizePhoneForCreate(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const normalized = normalizePhoneLoose(raw) ?? raw.replace(/[^\d+]/g, "");
  if (!normalized) return null;
  if (/^\+?[1-9]\d{1,14}$/.test(normalized)) return normalized;
  return null;
}

function normalizeReviewPhones(rawInput: unknown): unknown {
  if (!rawInput || typeof rawInput !== "object") return rawInput;
  const input = rawInput as { candidate?: unknown };
  if (!input.candidate || typeof input.candidate !== "object") return rawInput;
  const candidate = input.candidate as Record<string, unknown>;
  return {
    ...input,
    candidate: {
      ...candidate,
      phone: sanitizePhoneForCreate(
        typeof candidate.phone === "string" ? candidate.phone : null
      ),
      alternatePhone: sanitizePhoneForCreate(
        typeof candidate.alternatePhone === "string"
          ? candidate.alternatePhone
          : null
      ),
    },
  };
}

function mappedToReviewDefaults(mapped: ResumeImportMappedDraft): ResumeImportMappedDraft {
  return {
    personal: { ...mapped.personal },
    professional: { ...mapped.professional },
    experiences: [...(mapped.experiences ?? [])],
    educations: [...(mapped.educations ?? [])],
    skills: [...(mapped.skills ?? [])],
    projects: [...(mapped.projects ?? [])],
    certifications: [...(mapped.certifications ?? [])],
  };
}

function failureReason(error: unknown): string {
  if (error instanceof RecruitmentDomainError) return error.code;
  if (error instanceof Error) return error.name || "Error";
  return "unknown";
}

/**
 * Best-effort intake blob cleanup after permanent candidate document exists.
 * Idempotent: missing files and repeated calls are safe.
 */
export async function cleanupConsumedIntakeStorage(input: {
  repository: CandidateRepository;
  storage: StorageAdapter;
  intakeId: string;
  storageKey: string | null | undefined;
}): Promise<void> {
  const key = input.storageKey ? String(input.storageKey) : "";
  if (key && isSafeIntakeResumeKey(input.intakeId, key)) {
    try {
      await input.storage.delete(key);
    } catch (error) {
      logger.warn("recruitment.intake.cleanup_storage_failed", {
        entityType: "intake",
        entityId: input.intakeId,
        reason: failureReason(error),
      });
    }
  }

  await input.repository.updateIntake(input.intakeId, {
    storageKey: null,
  });
}

export function createCandidateFromResumeService(
  repository: CandidateRepository = prismaCandidateRepository
) {
  const candidateService = createCandidateService(repository);
  const storage = getRecruitmentStorage();

  async function findExistingResumeParseInsight(
    candidateId: string,
    documentId: string | null
  ): Promise<string | null> {
    const rows = await repository.listInsights(candidateId, {
      insightType: AiInsightType.resume_parse,
    });
    for (const row of rows) {
      if (
        row.status !== AiInsightStatus.accepted &&
        row.status !== AiInsightStatus.pending_review
      ) {
        continue;
      }
      try {
        const content = parseResumeImportDraftContent(row.contentJson);
        if (documentId && content.documentId === documentId) {
          return String(row.id);
        }
        if (!documentId) return String(row.id);
      } catch {
        continue;
      }
    }
    return rows[0] ? String(rows[0].id) : null;
  }

  return {
    /**
     * Store resume on intake, run deterministic-v2 parser, return review draft.
     * Does not create a Candidate.
     */
    async parseForNewCandidate(
      session: SessionUser,
      input: {
        fileName: string;
        mimeType: string;
        content: Buffer | Uint8Array;
      }
    ): Promise<NewCandidateResumeReviewDraft> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const bytes = Buffer.from(input.content);
      assertResumeUploadMeta(input.fileName, bytes.byteLength);

      const { id: intakeId } = await repository.createIntake({
        status: IntakeItemStatus.received,
        source: CandidateSource.manual_upload,
        fileName: input.fileName,
        storageKey: null,
        rawPayloadJson: {},
        errorMessage: null,
        createdByUserId: session.id,
      });

      const storageKey = buildIntakeResumeStorageKey(intakeId, input.fileName);
      try {
        await storage.save(storageKey, bytes, {
          contentType: input.mimeType || "application/octet-stream",
        });
      } catch (err) {
        await repository.updateIntake(intakeId, {
          status: IntakeItemStatus.discarded,
          errorMessage: "Failed to store resume file.",
        });
        throw err;
      }

      const { result, draftContent } = await parseResumeWithLlm({
        content: bytes,
        fileName: input.fileName,
        mimeType: input.mimeType || "application/octet-stream",
        documentId: null,
      });

      const warnings = [...result.warnings];
      if (!result.ok) warnings.push(result.error.message);

      const payload: IntakePayload = {
        kind: "new_candidate_resume_v1",
        draftContent,
        fileName: input.fileName,
        mimeType: input.mimeType || "application/octet-stream",
        sizeBytes: bytes.byteLength,
        checksum: checksumBuffer(bytes),
      };

      await repository.updateIntake(intakeId, {
        status: result.ok ? IntakeItemStatus.parse_ready : IntakeItemStatus.parse_pending,
        storageKey,
        rawPayloadJson: payload,
        errorMessage: result.ok
          ? null
          : warnings.join(" ") || "Could not extract readable text from this resume.",
      });

      return {
        intakeId,
        fileName: input.fileName,
        mimeType: input.mimeType || "application/octet-stream",
        sizeBytes: bytes.byteLength,
        warnings,
        parseOk: result.ok,
        errorNote: result.ok ? undefined : result.error.message,
        mapped: mappedToReviewDefaults(draftContent.mapped),
        aiInsights: draftContent.aiInsights ?? null,
        extractionMeta: draftContent.extractionMeta ?? null,
      };
    },

    /**
     * Create Candidate from recruiter-reviewed Parser V2 output + intake resume.
     * Candidate TX commits first; resume attach is best-effort with explicit result.
     */
    async createFromReview(
      session: SessionUser,
      rawInput: unknown
    ): Promise<CreateCandidateFromResumeResult> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanManageCandidates(session);

      const parsedReview = createCandidateFromResumeReviewSchema.safeParse(
        normalizeReviewPhones(rawInput)
      );
      if (!parsedReview.success) {
        throw new RecruitmentDomainError(
          "REC_VALIDATION",
          parsedReview.error.issues[0]?.message ?? "Invalid review payload."
        );
      }
      const review = parsedReview.data;

      const intake = await repository.findIntake(review.intakeId);
      if (!intake) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Resume intake not found.");
      }
      if (String(intake.createdByUserId ?? "") !== session.id) {
        throw new RecruitmentDomainError(
          "REC_FORBIDDEN_SCOPE",
          "Resume intake does not belong to this user."
        );
      }

      const rawPayload = intake.rawPayloadJson as IntakePayload | null;
      if (!rawPayload || rawPayload.kind !== "new_candidate_resume_v1") {
        throw new RecruitmentDomainError("REC_VALIDATION", "Invalid intake payload.");
      }

      const draftContent = parseResumeImportDraftContent(rawPayload.draftContent);
      const intakeStorageKey = String(intake.storageKey ?? "");
      const existingCandidateId =
        typeof intake.candidateId === "string" && intake.candidateId
          ? intake.candidateId
          : null;
      const intakeStatus = String(intake.status ?? "");

      // Idempotent success: intake already fully consumed.
      if (existingCandidateId && intakeStatus === IntakeItemStatus.confirmed) {
        const existingDoc = await repository.findDocumentByChecksum(
          existingCandidateId,
          rawPayload.checksum
        );
        const documentId = existingDoc ? String(existingDoc.id) : null;
        const sourceDraftId =
          (await findExistingResumeParseInsight(existingCandidateId, documentId)) ??
          "";

        await cleanupConsumedIntakeStorage({
          repository,
          storage,
          intakeId: review.intakeId,
          storageKey: intake.storageKey as string | null,
        });

        return {
          candidateId: existingCandidateId,
          sourceDraftId,
          resumeAttached: Boolean(documentId && sourceDraftId),
          resumeAttachmentError:
            documentId && sourceDraftId ? undefined : RESUME_ATTACH_FAILURE_MESSAGE,
        };
      }

      let candidateId = existingCandidateId;

      // Built once, up front, so it can ride into the SAME transaction as the
      // candidate row when this is a fresh single-pass creation. documentId is
      // patched in after the permanent copy exists (storage I/O can't be part
      // of the DB transaction) — see the tx block below.
      const insightContent: ResumeImportDraftContent = {
        ...draftContent,
        documentId: null,
        source: "parser",
        mapped: {
          personal: {
            fullName: review.candidate.fullName,
            firstName: review.candidate.firstName ?? null,
            lastName: review.candidate.lastName ?? null,
            email: review.candidate.email ?? null,
            phone: sanitizePhoneForCreate(review.candidate.phone),
            location: review.candidate.location ?? null,
          },
          professional: {
            headline: review.candidate.headline ?? null,
            professionalSummary: review.candidate.professionalSummary ?? null,
            currentCompany: review.candidate.currentCompany ?? null,
            currentTitle: review.candidate.currentTitle ?? null,
            githubUrl: review.candidate.githubUrl ?? null,
            linkedinUrl: review.candidate.linkedinUrl ?? null,
            portfolioUrl: review.candidate.portfolioUrl ?? null,
            totalExperienceYears: review.candidate.totalExperienceYears ?? null,
            preferredWorkMode: review.candidate.preferredWorkMode ?? null,
            willingToRelocate: review.candidate.willingToRelocate ?? null,
          },
          experiences: review.experiences,
          educations: review.educations,
          skills: review.skills,
          projects: review.projects,
          certifications: review.certifications,
        },
      };

      // Set only when this call creates a brand-new candidate — the resume_parse
      // insight then already exists (same tx as the candidate) before we ever
      // reach the document-attach step below.
      let insightId: string | null = null;

      if (!candidateId) {
        const scalar: Record<string, unknown> = {
          ...review.candidate,
          phone: sanitizePhoneForCreate(review.candidate.phone),
          alternatePhone: sanitizePhoneForCreate(review.candidate.alternatePhone),
          source: CandidateSource.manual_upload,
          status: CandidateStatus.active,
          createdByUserId: session.id,
        };
        for (const key of DENIED) {
          delete scalar[key];
        }

        const dob = review.candidate.dateOfBirth;
        if (dob instanceof Date) {
          scalar.dateOfBirth = dob.toISOString().slice(0, 10);
        } else if (dob == null) {
          delete scalar.dateOfBirth;
        }

        const createInput: CandidateCreateData = {
          ...(scalar as CandidateCreateData),
          source: CandidateSource.manual_upload,
          status: CandidateStatus.active,
          createdByUserId: session.id,
          currentCtc: undefined,
          expectedCtc: undefined,
          noticePeriodDays: undefined,
          earliestJoinDate: undefined,
          availabilityNotes: undefined,
          doNotHireReason: undefined,
          preferredLocation: undefined,
          experiences: review.experiences.map((e, i) => ({
            company: e.company,
            title: e.title,
            location: e.location ?? null,
            startDate: e.startDate ? new Date(e.startDate) : null,
            endDate: e.endDate ? new Date(e.endDate) : null,
            isCurrent: e.isCurrent ?? false,
            description: e.description ?? null,
            sortOrder: e.sortOrder ?? i,
          })),
          educations: review.educations.map((e, i) => ({
            institution: e.institution,
            degree: e.degree ?? null,
            field: e.field ?? null,
            fieldOfStudy: e.field ?? null,
            startYear: e.startYear ?? null,
            endYear: e.endYear ?? null,
            grade: e.grade ?? null,
            sortOrder: e.sortOrder ?? i,
          })),
          skills: review.skills.map((s) => ({
            name: s.name,
            proficiency: s.proficiency ?? null,
            yearsOfExperience: s.yearsOfExperience ?? null,
            isConfirmed: true,
          })),
          projects: review.projects.map((p, i) => ({
            title: p.title,
            summary: p.summary ?? null,
            techStack: p.techStack ?? null,
            url: p.url ?? null,
            duration: p.duration ?? null,
            role: null,
            sortOrder: p.sortOrder ?? i,
          })),
          certifications: review.certifications.map((c) => ({
            name: c.name,
            issuer: c.issuer ?? null,
            issuedAt: c.issuedAt ? new Date(c.issuedAt) : null,
            credentialUrl: c.credentialUrl ?? null,
            credentialId: c.credentialId ?? null,
          })),
        };

        const created = await candidateService.createCandidate(session, {
          ...createInput,
          initialAiInsight: {
            contentJson: insightContent,
            modelId: draftContent.metadata?.parserVersion ?? null,
          },
        });
        candidateId = created.id;
        insightId = created.insightId ?? null;

        // Claim intake immediately so retries do not create a second candidate.
        await repository.updateIntake(review.intakeId, {
          candidateId,
          errorMessage: null,
        });
      }

      const attachFailed = async (stage: string, error: unknown) => {
        logger.warn("recruitment.new_candidate.resume_attach_failed", {
          entityType: "candidate",
          entityId: candidateId,
          intakeId: review.intakeId,
          stage,
          reason: failureReason(error),
        });
        await repository
          .updateIntake(review.intakeId, {
            candidateId,
            errorMessage: RESUME_ATTACH_FAILURE_MESSAGE,
          })
          .catch(() => undefined);

        return {
          candidateId,
          sourceDraftId: "",
          resumeAttached: false,
          resumeAttachmentError: RESUME_ATTACH_FAILURE_MESSAGE,
        } satisfies CreateCandidateFromResumeResult;
      };

      // --- Permanent resume attach (after candidate commit) ---
      if (!intakeStorageKey || !isSafeIntakeResumeKey(review.intakeId, intakeStorageKey)) {
        return attachFailed(
          "missing_intake_key",
          new RecruitmentDomainError("REC_NOT_FOUND", "Resume file is missing from intake storage.")
        );
      }
      if (!(await storage.exists(intakeStorageKey))) {
        return attachFailed(
          "missing_intake_file",
          new RecruitmentDomainError("REC_NOT_FOUND", "Resume file not found in storage.")
        );
      }

      let documentId: string | null = null;
      let docKey: string | null = null;

      try {
        const existingDoc = await repository.findDocumentByChecksum(
          candidateId,
          rawPayload.checksum
        );
        if (existingDoc) {
          const existingKey = String(existingDoc.storageKey ?? "");
          if (existingKey && (await storage.exists(existingKey))) {
            documentId = String(existingDoc.id);
            docKey = existingKey;
          }
        }

        if (!documentId) {
          const fileBytes = await storage.read(intakeStorageKey);
          docKey = buildCandidateDocumentStorageKey(candidateId, rawPayload.fileName);
          await storage.save(docKey, fileBytes, {
            contentType: rawPayload.mimeType,
          });
        }
      } catch (error) {
        return attachFailed("permanent_copy", error);
      }

      // Permanent copy exists (or reused). Metadata TX next — do not delete permanent file on failure.
      try {
        const sourceDraftId = await withRecruitmentTransaction(async (tx) => {
          let resolvedDocumentId = documentId;
          if (!resolvedDocumentId) {
            const createdDoc = await repository.addDocument(
              candidateId,
              {
                documentType: RecruitmentDocumentType.resume,
                fileName: rawPayload.fileName,
                mimeType: rawPayload.mimeType,
                sizeBytes: rawPayload.sizeBytes,
                storageKey: docKey,
                storagePath: docKey,
                checksum: rawPayload.checksum,
                version: 1,
                isPrimary: true,
                uploadedByUserId: session.id,
                size: rawPayload.sizeBytes,
              },
              tx
            );
            resolvedDocumentId = createdDoc.id;
          }

          let resolvedInsightId = insightId;

          if (resolvedInsightId) {
            // resume_parse insight already exists — created in the SAME transaction
            // as the candidate row (see candidate-service.ts::createCandidate).
            // Only the documentId was unknown at that point; patch it in now.
            await repository.updateInsightContent(
              resolvedInsightId,
              { ...insightContent, documentId: resolvedDocumentId },
              tx
            );
          } else {
            // Retry / legacy path: candidate already existed with no resume_parse
            // insight yet (e.g. a previous attempt failed after candidate commit
            // but before this step). Reuse if one showed up since, else create.
            resolvedInsightId = await findExistingResumeParseInsight(
              candidateId,
              resolvedDocumentId
            );
          }

          if (!resolvedInsightId) {
            const createdInsight = await repository.createInsight(
              candidateId,
              {
                insightType: AiInsightType.resume_parse,
                status: AiInsightStatus.accepted,
                title: "Resume import (new candidate)",
                contentJson: { ...insightContent, documentId: resolvedDocumentId },
                confidence: null,
                modelId: draftContent.metadata?.parserVersion ?? null,
                createdByUserId: session.id,
              },
              tx
            );
            resolvedInsightId = createdInsight.id;

            await repository.updateInsightStatus(
              resolvedInsightId,
              AiInsightStatus.accepted,
              tx,
              { reviewedByUserId: session.id, reviewedAt: new Date() }
            );
          }

          await prismaTimelineProjectionRepository.append(
            {
              entityType: "candidate",
              entityId: candidateId,
              candidateId,
              eventType: "candidate_created_from_resume",
              summary: "Candidate created from resume",
              actorUserId: session.id,
              metadata: {
                intakeId: review.intakeId,
                documentId: resolvedDocumentId,
                insightId: resolvedInsightId,
              },
            },
            tx
          );

          await repository.updateIntake(
            review.intakeId,
            {
              status: IntakeItemStatus.confirmed,
              candidateId,
              errorMessage: null,
            },
            tx
          );

          return resolvedInsightId;
        });

        // Only after permanent document + insight + confirmed intake:
        await cleanupConsumedIntakeStorage({
          repository,
          storage,
          intakeId: review.intakeId,
          storageKey: intakeStorageKey,
        });

        logger.info("recruitment.new_candidate.resume_attached", {
          entityType: "candidate",
          entityId: candidateId,
          intakeId: review.intakeId,
        });

        return {
          candidateId,
          sourceDraftId,
          resumeAttached: true,
        };
      } catch (error) {
        // Keep permanent candidate file for retry; do not delete intake file.
        return attachFailed("metadata_transaction", error);
      }
    },
  };
}

export type CandidateFromResumeService = ReturnType<
  typeof createCandidateFromResumeService
>;
