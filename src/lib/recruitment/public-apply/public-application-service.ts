import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { PublicApplicationSubmission } from "@/generated/prisma/client";
import {
  CandidateSource,
  CandidateStatus,
  PublicSubmissionStatus,
  RecruitmentDocumentType,
  AiInsightType,
  AiInsightStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, type RateLimitResult } from "@/lib/rate-limit";
import { logger } from "@/lib/observability/logger";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import {
  createApplicationCore,
  type ApplicationCoreJob,
} from "@/lib/recruitment/services/application-service";
import { prismaApplicationRepository } from "@/lib/recruitment/repositories/prisma-application-repository";
import { prismaCandidateRepository } from "@/lib/recruitment/repositories/prisma-candidate-repository";
import type { CandidateCreateData } from "@/lib/recruitment/candidate/types";
import { prismaJobRepository } from "@/lib/recruitment/repositories/prisma-job-repository";
import {
  normalizeEmail,
  normalizePhone,
} from "@/lib/recruitment/candidate/candidate-normalizer";
import { getRecruitmentStorage } from "@/lib/recruitment/storage/recruitment-storage";
import {
  buildCandidateDocumentStorageKey,
  buildPublicIntakeStorageKey,
  isSafePublicIntakeKey,
  monthPartitionFor,
} from "@/lib/recruitment/shared/storage-paths";
import { parseResumeDocument } from "@/lib/recruitment/resume-import/parser";
import type { ResumeImportDraftContent } from "@/lib/recruitment/resume-import/types";
import { RESUME_UPLOAD_MAX_BYTES } from "@/lib/recruitment/resume-import/file-validation";
import { resolveCandidateForPublicApplication } from "@/lib/recruitment/public-apply/candidate-resolution";
import {
  getOpenPublicJobById,
  resolvePublicJobBySlug,
} from "@/lib/recruitment/public-apply/public-job-query";
import { buildSubmissionToken, verifySubmissionTokenSignature } from "@/lib/recruitment/public-apply/token-service";
import {
  isTransitionAllowed,
  PublicApplyError,
  TERMINAL_STATUSES,
  type PublicJobOpeningDTO,
  type PublicReviewPayload,
} from "@/lib/recruitment/public-apply/types";
import type { RecruitmentActor } from "@/lib/recruitment/types/actor";
import type {
  PublicBasicInfoInput,
  PublicReviewPayloadInput,
} from "@/lib/validation/schemas/recruitment/public-apply";
import { publicReviewPayloadSchema } from "@/lib/validation/schemas/recruitment/public-apply";
import {
  queueCandidateConfirmation,
  queueHrPublicApplicationAlert,
} from "@/lib/recruitment/public-apply/notifications";
import { checkForBot } from "@/lib/recruitment/public-apply/bot-check";

const SUBMISSION_TTL_MS = 48 * 60 * 60 * 1000; // 48h — see Phase-3 design §5

/**
 * Sentinel actor for domain-event / timeline attribution ONLY on public
 * submissions. Never used for permission/scope checks — the public flow has
 * no session and never calls RecruitmentPermissionService/ScopeEngine.
 */
const PUBLIC_APPLY_ACTOR: RecruitmentActor = {
  userId: "system:public-apply",
  email: "public-apply@system.local",
  role: "hr",
  employeeId: null,
  recruitmentOpsAccess: false,
};

/** Per-endpoint limits from Phase-3 design §14. In-memory limiter — fine for
 * this deployment's confirmed single-instance, persistent-disk ECS target. */
const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  start: { max: 10, windowMs: 15 * 60 * 1000 },
  "basic-info": { max: 30, windowMs: 60 * 60 * 1000 },
  resume: { max: 10, windowMs: 60 * 60 * 1000 },
  parse: { max: 10, windowMs: 60 * 60 * 1000 },
  review: { max: 30, windowMs: 60 * 60 * 1000 },
  submit: { max: 5, windowMs: 60 * 60 * 1000 },
};

export function checkPublicApplyRateLimit(scope: keyof typeof RATE_LIMITS, key: string): RateLimitResult {
  const limit = RATE_LIMITS[scope];
  return checkRateLimit(`public-apply:${scope}:${key}`, limit.max, limit.windowMs);
}

type SubmissionRow = PublicApplicationSubmission;

function failureReason(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return "unknown";
}

/** Best-effort temp-file delete — never blocks the caller. */
async function deleteTempResumeBestEffort(row: Pick<SubmissionRow, "id" | "resumeStorageKey">) {
  if (!row.resumeStorageKey) return;
  try {
    await getRecruitmentStorage().delete(row.resumeStorageKey);
  } catch (err) {
    logger.warn("recruitment.public_apply.temp_resume_delete_failed", {
      entityType: "public_application_submission",
      entityId: row.id,
      reason: failureReason(err),
    });
  }
}

/**
 * Exported for the scheduled expiry sweep (expire-submissions-batch.ts);
 * loadAndVerify() below is the other, lazy caller.
 */
export async function expireSubmission(row: SubmissionRow): Promise<void> {
  await deleteTempResumeBestEffort(row);
  await prisma.publicApplicationSubmission.updateMany({
    where: { id: row.id, status: { notIn: [...TERMINAL_STATUSES] } },
    data: { status: PublicSubmissionStatus.expired, resumeStorageKey: null },
  });
}

/** Verifies token signature + DB state, lazily expiring past-TTL rows (same
 * pattern as ApprovalToken's markExpiredIfNeeded). Throws PublicApplyError on
 * any invalid/expired/consumed state. */
async function loadAndVerify(
  token: string,
  opts?: { allowTerminal?: boolean }
): Promise<SubmissionRow> {
  const parsed = verifySubmissionTokenSignature(token);
  if (!parsed) {
    throw new PublicApplyError("SESSION_INVALID", "Your session isn't valid. Please start your application again.");
  }

  let row = await prisma.publicApplicationSubmission.findUnique({
    where: { id: parsed.submissionId },
  });
  if (!row) {
    throw new PublicApplyError("SESSION_INVALID", "Your session isn't valid. Please start your application again.");
  }

  if (!TERMINAL_STATUSES.includes(row.status) && row.expiresAt.getTime() < Date.now()) {
    await expireSubmission(row);
    row = { ...row, status: PublicSubmissionStatus.expired, resumeStorageKey: null };
  }

  if (!opts?.allowTerminal) {
    if (row.status === PublicSubmissionStatus.expired) {
      throw new PublicApplyError("SESSION_EXPIRED", "Your application session has expired. Please start again.");
    }
    if (row.status === PublicSubmissionStatus.submitted) {
      throw new PublicApplyError("ALREADY_SUBMITTED", "This application has already been submitted.");
    }
    if (row.status === PublicSubmissionStatus.job_closed) {
      throw new PublicApplyError("JOB_UNAVAILABLE", "This job posting is no longer available.");
    }
  }

  return row;
}

function assertTransition(from: PublicSubmissionStatus, to: PublicSubmissionStatus): void {
  if (from === to) return; // idempotent re-save states are explicit self-edges in ALLOWED_TRANSITIONS
  if (!isTransitionAllowed(from, to)) {
    throw new PublicApplyError(
      "VALIDATION_FAILED",
      "This step isn't available right now — please refresh and continue from where you left off."
    );
  }
}

// --- A. Start submission (§4A) ----------------------------------------------

export async function startPublicSubmission(input: {
  jobPublicSlug: string;
  ipHash: string | null;
  /** Honeypot — a real candidate never sees or fills this field. */
  website?: string;
  /** Client-recorded Date.now() when the form mounted. */
  formRenderedAt?: number;
}): Promise<{ token: string; expiresAt: string; job: PublicJobOpeningDTO }> {
  const botCheck = checkForBot(input);
  if (botCheck.blocked) {
    logger.info("recruitment.public_apply.bot_rejected", {
      entityType: "public_application_submission",
      reason: botCheck.reason,
    });
    throw new PublicApplyError("VALIDATION_FAILED", "Unable to start your application. Please try again.");
  }

  const job = await resolvePublicJobBySlug(input.jobPublicSlug);
  if (!job) {
    throw new PublicApplyError("JOB_UNAVAILABLE", "This job posting is no longer available.", 404);
  }

  const expiresAt = new Date(Date.now() + SUBMISSION_TTL_MS);
  const created = await prisma.publicApplicationSubmission.create({
    data: {
      jobOpeningId: job.id,
      status: PublicSubmissionStatus.started,
      expiresAt,
      ipHash: input.ipHash,
    },
    select: { id: true },
  });

  // `job` here is PublicJobOpeningDTO & { id } — resolvePublicJobBySlug()
  // deliberately keeps the internal id for this write-side call (needed
  // above for jobOpeningId), but the response to the anonymous client must
  // never include it. Reconstruct explicitly rather than spreading `job` —
  // TS's structural typing does NOT strip excess properties from a
  // variable of a wider type, only from object literals, so `return {
  // ..., job }` would silently leak `id` despite the PublicJobOpeningDTO
  // return-type annotation. (Caught via real HTTP verification — the
  // response body genuinely included `job.id`.)
  const publicJob: PublicJobOpeningDTO = {
    publicSlug: job.publicSlug,
    title: job.title,
    department: job.department,
    location: job.location,
    workMode: job.workMode,
    employmentType: job.employmentType,
    description: job.description,
    publishedAt: job.publishedAt,
  };

  return { token: buildSubmissionToken(created.id), expiresAt: expiresAt.toISOString(), job: publicJob };
}

// --- B. Save basic information (§4B) ----------------------------------------

export async function saveBasicInfo(token: string, input: PublicBasicInfoInput): Promise<void> {
  const submission = await loadAndVerify(token);
  assertTransition(submission.status, PublicSubmissionStatus.basic_info_complete);

  await prisma.publicApplicationSubmission.update({
    where: { id: submission.id },
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      normalizedEmail: normalizeEmail(input.email),
      normalizedPhone: normalizePhone(input.phone),
      status: PublicSubmissionStatus.basic_info_complete,
    },
  });
}

// --- C. Resume upload (§4C) --------------------------------------------------

const PDF_SIGNATURE = Buffer.from("%PDF-", "ascii");
const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
];

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

/** Extension + MIME + magic-byte sniffing — never trust client-declared MIME alone. */
function assertResumeFile(fileName: string, mimeType: string, content: Buffer): void {
  const ext = extensionOf(fileName);
  if (ext !== "pdf" && ext !== "docx") {
    throw new PublicApplyError("RESUME_INVALID", "Please upload a PDF or Word document.");
  }
  if (content.byteLength <= 0) {
    throw new PublicApplyError("RESUME_INVALID", "The selected file is empty.");
  }
  if (content.byteLength > RESUME_UPLOAD_MAX_BYTES) {
    throw new PublicApplyError("RESUME_TOO_LARGE", "File is too large. Maximum size is 10 MB.");
  }
  const head = content.subarray(0, 8);
  if (ext === "pdf" && !head.subarray(0, 5).equals(PDF_SIGNATURE)) {
    throw new PublicApplyError("RESUME_INVALID", "This file doesn't look like a valid PDF.");
  }
  if (ext === "docx" && !ZIP_SIGNATURES.some((sig) => head.subarray(0, sig.length).equals(sig))) {
    throw new PublicApplyError("RESUME_INVALID", "This file doesn't look like a valid Word document.");
  }
  void mimeType; // MIME header is informational only — extension + magic bytes decide.
}

export async function uploadResume(
  token: string,
  input: { fileName: string; mimeType: string; content: Buffer }
): Promise<void> {
  const submission = await loadAndVerify(token);
  const uploadableFrom: PublicSubmissionStatus[] = [
    PublicSubmissionStatus.basic_info_complete,
    PublicSubmissionStatus.resume_uploaded,
    PublicSubmissionStatus.parse_failed,
    PublicSubmissionStatus.upload_failed,
  ];
  if (!uploadableFrom.includes(submission.status)) {
    throw new PublicApplyError("VALIDATION_FAILED", "Please complete your basic information first.");
  }

  assertResumeFile(input.fileName, input.mimeType, input.content);

  await deleteTempResumeBestEffort(submission);

  const monthPartition = monthPartitionFor(new Date());
  const key = buildPublicIntakeStorageKey(submission.id, input.fileName, monthPartition);

  try {
    await getRecruitmentStorage().save(key, input.content, { contentType: input.mimeType });
  } catch (err) {
    await prisma.publicApplicationSubmission.update({
      where: { id: submission.id },
      data: { status: PublicSubmissionStatus.upload_failed },
    });
    logger.warn("recruitment.public_apply.upload_failed", {
      entityType: "public_application_submission",
      entityId: submission.id,
      reason: failureReason(err),
    });
    throw new PublicApplyError("TEMPORARY_FAILURE", "Could not store your resume. Please try again.", 500);
  }

  const checksum = createHash("sha256").update(input.content).digest("hex");
  await prisma.publicApplicationSubmission.update({
    where: { id: submission.id },
    data: {
      resumeFileName: input.fileName,
      resumeMimeType: input.mimeType,
      resumeSizeBytes: input.content.byteLength,
      resumeStorageKey: key,
      resumeChecksum: checksum,
      status: PublicSubmissionStatus.resume_uploaded,
      parsedProposalJson: Prisma.JsonNull,
      candidateEditedJson: Prisma.JsonNull,
      parseFailureReason: null,
    },
  });
}

// --- D. Parse resume (§4D) ---------------------------------------------------

export type ParseOutcome =
  | { status: "ready_for_review" }
  | { status: "parse_failed"; reason: string };

export async function parseSubmissionResume(token: string): Promise<ParseOutcome> {
  const submission = await loadAndVerify(token);
  const parseableFrom: PublicSubmissionStatus[] = [
    PublicSubmissionStatus.resume_uploaded,
    PublicSubmissionStatus.parse_failed,
  ];
  if (!parseableFrom.includes(submission.status) || !submission.resumeStorageKey) {
    throw new PublicApplyError("VALIDATION_FAILED", "Upload a resume first.");
  }

  await prisma.publicApplicationSubmission.update({
    where: { id: submission.id },
    data: { status: PublicSubmissionStatus.parsing },
  });

  let fileBytes: Buffer;
  try {
    fileBytes = await getRecruitmentStorage().read(submission.resumeStorageKey);
  } catch (err) {
    await prisma.publicApplicationSubmission.update({
      where: { id: submission.id },
      data: { status: PublicSubmissionStatus.parse_failed, parseFailureReason: "storage_read_failed" },
    });
    logger.warn("recruitment.public_apply.parse_read_failed", {
      entityType: "public_application_submission",
      entityId: submission.id,
      reason: failureReason(err),
    });
    return { status: "parse_failed", reason: "storage_read_failed" };
  }

  const { result, draftContent } = await parseResumeDocument({
    content: fileBytes,
    fileName: submission.resumeFileName ?? "resume.pdf",
    mimeType: submission.resumeMimeType ?? "application/octet-stream",
    documentId: null,
    forceDeterministic: true, // never LLM in public intake — see Phase-3 design §7
  });

  if (!result.ok) {
    await prisma.publicApplicationSubmission.update({
      where: { id: submission.id },
      data: {
        status: PublicSubmissionStatus.parse_failed,
        parseFailureReason: result.error.code,
        parserVersion: draftContent.metadata.parserVersion ?? null,
      },
    });
    return { status: "parse_failed", reason: result.error.code };
  }

  await prisma.publicApplicationSubmission.update({
    where: { id: submission.id },
    data: {
      status: PublicSubmissionStatus.ready_for_review,
      parsedProposalJson: draftContent as unknown as Prisma.InputJsonValue,
      candidateEditedJson: draftContent.mapped as unknown as Prisma.InputJsonValue,
      parserVersion: draftContent.metadata.parserVersion ?? null,
      parseFailureReason: null,
    },
  });

  return { status: "ready_for_review" };
}

// --- E. Get review data (§4E) ------------------------------------------------

const EMPTY_REVIEW_PAYLOAD: PublicReviewPayload = {
  personal: { fullName: "", firstName: null, lastName: null, email: null, phone: null, location: null },
  professional: {
    headline: null,
    professionalSummary: null,
    currentCompany: null,
    currentTitle: null,
    githubUrl: null,
    linkedinUrl: null,
    portfolioUrl: null,
    totalExperienceYears: null,
    preferredWorkMode: null,
    willingToRelocate: null,
  },
  experiences: [],
  educations: [],
  skills: [],
  projects: [],
  certifications: [],
};

export async function getReview(
  token: string
): Promise<{ status: PublicSubmissionStatus; review: PublicReviewPayload; canContinueManually: boolean }> {
  const submission = await loadAndVerify(token);
  const reviewableFrom: PublicSubmissionStatus[] = [
    PublicSubmissionStatus.ready_for_review,
    PublicSubmissionStatus.candidate_edited,
    PublicSubmissionStatus.parse_failed,
  ];
  if (!reviewableFrom.includes(submission.status)) {
    throw new PublicApplyError("VALIDATION_FAILED", "Nothing to review yet.");
  }

  const review = (submission.candidateEditedJson as unknown as PublicReviewPayload | null) ?? {
    ...EMPTY_REVIEW_PAYLOAD,
    personal: {
      ...EMPTY_REVIEW_PAYLOAD.personal,
      fullName: submission.fullName ?? "",
      email: submission.email,
      phone: submission.phone,
    },
  };

  return { status: submission.status, review, canContinueManually: true };
}

// --- F. Update candidate-reviewed data (§4F) ---------------------------------

export async function updateReview(token: string, payload: PublicReviewPayloadInput): Promise<void> {
  const submission = await loadAndVerify(token);
  const editableFrom: PublicSubmissionStatus[] = [
    PublicSubmissionStatus.ready_for_review,
    PublicSubmissionStatus.candidate_edited,
    PublicSubmissionStatus.parse_failed,
  ];
  if (!editableFrom.includes(submission.status)) {
    throw new PublicApplyError("VALIDATION_FAILED", "Nothing to review yet.");
  }

  const parsed = publicReviewPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PublicApplyError(
      "VALIDATION_FAILED",
      parsed.error.issues[0]?.message ?? "Please check the highlighted fields."
    );
  }

  await prisma.publicApplicationSubmission.update({
    where: { id: submission.id },
    data: {
      candidateEditedJson: parsed.data as unknown as Prisma.InputJsonValue,
      status: PublicSubmissionStatus.candidate_edited,
      // Basic-info fields stay in sync with the review screen's personal section
      // so a candidate who fixes their email/phone during review doesn't leave
      // stale values behind for dedup/notification.
      fullName: parsed.data.personal.fullName,
      email: parsed.data.personal.email,
      phone: parsed.data.personal.phone,
      normalizedEmail: normalizeEmail(parsed.data.personal.email),
      normalizedPhone: normalizePhone(parsed.data.personal.phone),
    },
  });
}

// --- G. Final submit (§4G) ---------------------------------------------------

export type SubmitResult = { referenceCode: string; alreadySubmitted: boolean };

function referenceCodeFor(submissionId: string): string {
  return submissionId.slice(-8).toUpperCase();
}

function mapCandidateCreateData(
  review: PublicReviewPayloadInput,
  source: CandidateSource
): CandidateCreateData {
  const normalizedEmail = normalizeEmail(review.personal.email);
  const normalizedPhone = normalizePhone(review.personal.phone);
  return {
    fullName: review.personal.fullName,
    firstName: review.personal.firstName ?? null,
    lastName: review.personal.lastName ?? null,
    email: review.personal.email,
    phone: review.personal.phone,
    location: review.personal.location ?? null,
    headline: review.professional.headline ?? null,
    professionalSummary: review.professional.professionalSummary ?? null,
    currentCompany: review.professional.currentCompany ?? null,
    currentTitle: review.professional.currentTitle ?? null,
    githubUrl: review.professional.githubUrl ?? null,
    linkedinUrl: review.professional.linkedinUrl ?? null,
    portfolioUrl: review.professional.portfolioUrl ?? null,
    totalExperienceYears: review.professional.totalExperienceYears ?? null,
    preferredWorkMode: review.professional.preferredWorkMode ?? null,
    willingToRelocate: review.professional.willingToRelocate ?? null,
    source,
    status: CandidateStatus.active,
    createdByUserId: null,
    normalizedEmail,
    normalizedPhone,
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
      role: p.role ?? null,
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
}

export async function submitPublicApplication(token: string): Promise<SubmitResult> {
  const submission = await loadAndVerify(token);

  const submittableFrom: PublicSubmissionStatus[] = [
    PublicSubmissionStatus.ready_for_review,
    PublicSubmissionStatus.candidate_edited,
    PublicSubmissionStatus.submission_failed,
  ];
  if (!submittableFrom.includes(submission.status)) {
    throw new PublicApplyError("VALIDATION_FAILED", "Please review your information before submitting.");
  }

  const rawReview = submission.candidateEditedJson as unknown;
  const parsedReview = publicReviewPayloadSchema.safeParse(rawReview);
  if (!parsedReview.success) {
    throw new PublicApplyError(
      "VALIDATION_FAILED",
      "Please complete your information before submitting."
    );
  }
  const review = parsedReview.data;

  // Job re-check #1 (before claiming the submission) — see design §3/§4G.
  const openJob = await getOpenPublicJobById(submission.jobOpeningId);
  if (!openJob) {
    await prisma.publicApplicationSubmission.updateMany({
      where: { id: submission.id, status: { in: submittableFrom } },
      data: { status: PublicSubmissionStatus.job_closed },
    });
    throw new PublicApplyError("JOB_UNAVAILABLE", "This job posting is no longer accepting applications.");
  }

  const resolution = await resolveCandidateForPublicApplication({
    email: review.personal.email,
    phone: review.personal.phone,
  });

  const events = createAfterCommitBuffer();
  let outcome: { candidateId: string; applicationId: string; referenceCode: string };

  try {
    outcome = await withRecruitmentTransaction(async (tx) => {
      // Atomic idempotency guard — the ONE write that decides who "wins" a
      // double-submit / two-tab / retry race for this submission. See
      // Phase-3 design §12 (mirrors ApprovalToken's consumeApprovalToken()
      // conditional updateMany).
      const claimed = await tx.publicApplicationSubmission.updateMany({
        where: { id: submission.id, status: { in: submittableFrom } },
        data: { status: PublicSubmissionStatus.submitted, consumedAt: new Date(), consentGivenAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new PublicApplyError("ALREADY_SUBMITTED", "This application has already been submitted.");
      }

      // Job re-check #2 — inside the transaction snapshot, closes the window
      // between check #1 and the claim above.
      const jobRow = await tx.jobOpening.findFirst({
        where: { id: submission.jobOpeningId, status: "open", isPubliclyListed: true, deletedAt: null },
        select: { id: true, title: true },
      });
      if (!jobRow) {
        throw new PublicApplyError("JOB_UNAVAILABLE", "This job posting is no longer accepting applications.");
      }

      let candidateId: string;
      if (resolution.kind === "reuse") {
        candidateId = resolution.candidateId;
      } else {
        const createData = mapCandidateCreateData(review, CandidateSource.career_portal);
        const created = await prismaCandidateRepository.createCandidate(createData, tx);
        candidateId = created.id;
      }

      // Same duplicate-active-application guard the internal flow uses,
      // backed by the DB partial unique index for the genuine concurrent case.
      const activeApp = await prismaApplicationRepository.findActiveByCandidateAndJob(
        candidateId,
        submission.jobOpeningId
      );
      if (activeApp) {
        throw new PublicApplyError(
          "DUPLICATE_APPLICATION",
          "You already have an active application for this role. Our team will be in touch."
        );
      }

      const job = await prismaJobRepository.getJob(submission.jobOpeningId);
      const coreJob: ApplicationCoreJob = {
        title: jobRow.title,
        stages: job?.stages ?? [],
      };

      const { id: applicationId } = await createApplicationCore(
        prismaApplicationRepository,
        tx,
        events,
        {
          candidateId,
          jobOpeningId: submission.jobOpeningId,
          job: coreJob,
          source: CandidateSource.career_portal,
          createdByUserId: null,
          actor: PUBLIC_APPLY_ACTOR,
          summary: `Applied via career portal for job: ${jobRow.title}`,
        }
      );

      const referenceCode = referenceCodeFor(submission.id);
      await tx.publicApplicationSubmission.update({
        where: { id: submission.id },
        data: {
          resolvedCandidateId: candidateId,
          resolvedApplicationId: applicationId,
          referenceCode,
          duplicateOfCandidateId: resolution.kind === "create" ? resolution.duplicateOfCandidateId : null,
          duplicateConfidence: resolution.kind === "create" ? resolution.duplicateConfidence : null,
          submittedSnapshotJson: review as unknown as Prisma.InputJsonValue,
        },
      });

      return { candidateId, applicationId, referenceCode };
    });
  } catch (err) {
    if (err instanceof PublicApplyError && err.code === "ALREADY_SUBMITTED") {
      const current = await prisma.publicApplicationSubmission.findUnique({ where: { id: submission.id } });
      if (current?.resolvedApplicationId && current.referenceCode) {
        return { referenceCode: current.referenceCode, alreadySubmitted: true };
      }
    }
    if (err instanceof PublicApplyError) {
      if (err.code !== "DUPLICATE_APPLICATION" && err.code !== "JOB_UNAVAILABLE") {
        await prisma.publicApplicationSubmission.updateMany({
          where: { id: submission.id, status: { in: submittableFrom } },
          data: { status: PublicSubmissionStatus.submission_failed },
        });
      }
      throw err;
    }
    await prisma.publicApplicationSubmission.updateMany({
      where: { id: submission.id, status: { in: submittableFrom } },
      data: { status: PublicSubmissionStatus.submission_failed },
    });
    logger.warn("recruitment.public_apply.submit_failed", {
      entityType: "public_application_submission",
      entityId: submission.id,
      reason: failureReason(err),
    });
    throw new PublicApplyError("TEMPORARY_FAILURE", "Something went wrong on our end. Please try again in a moment.", 500);
  }

  await events.flush();

  // --- Best-effort resume attach (after commit) — mirrors the internal
  // create-candidate-from-resume-service.ts two-phase copy-then-metadata
  // pattern. Application already exists and is real either way. ---
  if (submission.resumeStorageKey && submission.resumeFileName) {
    await attachResumeBestEffort({
      submissionId: submission.id,
      candidateId: outcome.candidateId,
      resumeStorageKey: submission.resumeStorageKey,
      resumeFileName: submission.resumeFileName,
      resumeMimeType: submission.resumeMimeType,
      resumeSizeBytes: submission.resumeSizeBytes,
      resumeChecksum: submission.resumeChecksum,
      parsedProposalJson: submission.parsedProposalJson as unknown as ResumeImportDraftContent | null,
      candidateEditedJson: review,
    });
  }

  // --- P1 notifications (after commit, non-blocking) — see Phase-3
  // hardening §3/§4: queued via the existing notification queue, never
  // awaited in a way that could roll back or fail the submission itself
  // (both functions already swallow their own errors internally). ---
  await queueCandidateConfirmation({
    candidateEmail: review.personal.email,
    candidateName: review.personal.fullName,
    jobTitle: openJob.title,
    referenceCode: outcome.referenceCode,
  });
  await queueHrPublicApplicationAlert({
    ownerRecruiterUserId: openJob.ownerRecruiterUserId,
    candidateName: review.personal.fullName,
    jobTitle: openJob.title,
    applicationId: outcome.applicationId,
    referenceCode: outcome.referenceCode,
  });

  logger.info("recruitment.public_apply.submit_succeeded", {
    entityType: "public_application_submission",
    entityId: submission.id,
    candidateId: outcome.candidateId,
    applicationId: outcome.applicationId,
  });

  return { referenceCode: outcome.referenceCode, alreadySubmitted: false };
}

async function attachResumeBestEffort(input: {
  submissionId: string;
  candidateId: string;
  resumeStorageKey: string;
  resumeFileName: string;
  resumeMimeType: string | null;
  resumeSizeBytes: number | null;
  resumeChecksum: string | null;
  parsedProposalJson: ResumeImportDraftContent | null;
  candidateEditedJson: PublicReviewPayload;
}): Promise<void> {
  const storage = getRecruitmentStorage();
  const monthPartition = monthPartitionFor(new Date());
  if (!isSafePublicIntakeKey(input.submissionId, monthPartition, input.resumeStorageKey)) {
    // File may have been written in a prior month partition (long-running
    // submission near a month boundary) — fall back to a plain prefix check.
    if (!input.resumeStorageKey.startsWith(`public-intake/`)) {
      logger.warn("recruitment.public_apply.resume_attach_skipped_unsafe_key", {
        entityType: "candidate",
        entityId: input.candidateId,
        submissionId: input.submissionId,
      });
      return;
    }
  }

  try {
    const exists = await storage.exists(input.resumeStorageKey);
    if (!exists) {
      logger.warn("recruitment.public_apply.resume_attach_missing_file", {
        entityType: "candidate",
        entityId: input.candidateId,
        submissionId: input.submissionId,
      });
      return;
    }

    const fileBytes = await storage.read(input.resumeStorageKey);
    const docKey = buildCandidateDocumentStorageKey(input.candidateId, input.resumeFileName);
    await storage.save(docKey, fileBytes, { contentType: input.resumeMimeType ?? undefined });

    await withRecruitmentTransaction(async (tx) => {
      // Reused (email-matched) candidates can already have a primary resume
      // from an earlier application — the DB enforces at most one non-deleted
      // primary resume per candidate (candidate_documents_one_primary_resume,
      // migration 20260804150000). A brand-new candidate never has one yet.
      const existingPrimaryResume = await tx.candidateDocument.findFirst({
        where: {
          candidateId: input.candidateId,
          documentType: RecruitmentDocumentType.resume,
          isPrimary: true,
          deletedAt: null,
        },
        select: { id: true },
      });

      const doc = await prismaCandidateRepository.addDocument(
        input.candidateId,
        {
          documentType: RecruitmentDocumentType.resume,
          fileName: input.resumeFileName,
          mimeType: input.resumeMimeType,
          sizeBytes: input.resumeSizeBytes,
          storageKey: docKey,
          storagePath: docKey,
          checksum: input.resumeChecksum,
          version: 1,
          isPrimary: !existingPrimaryResume,
          uploadedByUserId: null,
          size: input.resumeSizeBytes,
        },
        tx
      );

      if (input.parsedProposalJson) {
        const insightContent: ResumeImportDraftContent = {
          ...input.parsedProposalJson,
          documentId: doc.id,
          source: "parser",
          mapped: input.candidateEditedJson,
        };
        const createdInsight = await prismaCandidateRepository.createInsight(
          input.candidateId,
          {
            insightType: AiInsightType.resume_parse,
            status: AiInsightStatus.accepted,
            title: "Resume import (public application)",
            contentJson: insightContent,
            confidence: null,
            modelId: insightContent.metadata?.parserVersion ?? null,
            createdByUserId: null,
          },
          tx
        );
        await prismaCandidateRepository.updateInsightStatus(
          createdInsight.id,
          AiInsightStatus.accepted,
          tx,
          { reviewedByUserId: null, reviewedAt: new Date() }
        );
      }
    });

    await getRecruitmentStorage().delete(input.resumeStorageKey);
  } catch (err) {
    logger.warn("recruitment.public_apply.resume_attach_failed", {
      entityType: "candidate",
      entityId: input.candidateId,
      submissionId: input.submissionId,
      reason: failureReason(err),
    });
  }
}
