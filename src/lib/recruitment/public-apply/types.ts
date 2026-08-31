import type { PublicSubmissionStatus } from "@/generated/prisma/enums";
import type { ResumeImportMappedDraft } from "@/lib/recruitment/resume-import/types";

export type PublicJobOpeningDTO = {
  publicSlug: string;
  title: string;
  department: string | null;
  location: string | null;
  workMode: string | null;
  employmentType: string;
  description: string;
  publishedAt: string | null;
};

/** Server-enforced state machine — see prisma/schema.prisma PublicSubmissionStatus doc. */
export const ALLOWED_TRANSITIONS: Record<PublicSubmissionStatus, PublicSubmissionStatus[]> = {
  started: ["basic_info_complete", "expired"],
  basic_info_complete: ["resume_uploaded", "basic_info_complete", "upload_failed", "expired"],
  resume_uploaded: ["parsing", "resume_uploaded", "expired"],
  parsing: ["ready_for_review", "parse_failed"],
  ready_for_review: [
    "candidate_edited",
    "submitted",
    "job_closed",
    "submission_failed",
    "expired",
  ],
  candidate_edited: [
    "candidate_edited",
    "submitted",
    "job_closed",
    "submission_failed",
    "expired",
  ],
  parse_failed: ["parsing", "candidate_edited", "expired"],
  upload_failed: ["resume_uploaded", "expired"],
  submission_failed: ["candidate_edited", "submitted", "job_closed", "expired"],
  submitted: [],
  job_closed: [],
  expired: [],
};

export function isTransitionAllowed(
  from: PublicSubmissionStatus,
  to: PublicSubmissionStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export const TERMINAL_STATUSES: readonly PublicSubmissionStatus[] = [
  "submitted",
  "job_closed",
  "expired",
];

export type PublicReviewSection = "experiences" | "educations" | "skills" | "projects" | "certifications";

/** Candidate-supplied compensation/availability — deliberately NOT part of
 * ResumeImportMappedDraft (see RESUME_IMPORT_DENIED_SCALAR_KEYS): these must
 * always come from the candidate typing them in, never from resume parsing. */
export type PublicCompensationMapped = {
  currentCtc?: string | null;
  noticePeriodDays?: number | null;
};

/** Candidate-editable review payload — same shape as ResumeImportMappedDraft
 * plus a candidate-entered compensation section, never includes
 * fieldConfidence or any parser-internal metadata. */
export type PublicReviewPayload = ResumeImportMappedDraft & {
  compensation: PublicCompensationMapped;
};

export type PublicErrorCode =
  | "JOB_UNAVAILABLE"
  | "SESSION_INVALID"
  | "SESSION_EXPIRED"
  | "ALREADY_SUBMITTED"
  | "RESUME_INVALID"
  | "RESUME_TOO_LARGE"
  | "PARSE_FAILED"
  | "VALIDATION_FAILED"
  | "DUPLICATE_APPLICATION"
  | "TEMPORARY_FAILURE"
  | "RATE_LIMITED"
  | "ORIGIN_INVALID";

export class PublicApplyError extends Error {
  readonly code: PublicErrorCode;
  readonly status: number;

  constructor(code: PublicErrorCode, message: string, status = 400) {
    super(message);
    this.name = "PublicApplyError";
    this.code = code;
    this.status = status;
  }
}
