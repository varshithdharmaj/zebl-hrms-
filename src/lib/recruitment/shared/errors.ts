import { PermissionError } from "@/lib/permissions";

/** Domain error codes — map to ActionState.error / REC_* catalog. */
export type RecruitmentErrorCode =
  | "REC_UNAUTHORIZED"
  | "REC_FORBIDDEN_SCOPE"
  | "REC_NOT_FOUND"
  | "REC_VALIDATION"
  | "REC_CONFLICT"
  | "REC_PRECONDITION"
  | "REC_INTERNAL"
  | "REC_FEATURE_DISABLED"
  | "REC_JOB_ILLEGAL_STATUS"
  | "REC_JOB_SINGLE_HM";

export class RecruitmentDomainError extends Error {
  readonly code: RecruitmentErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: RecruitmentErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "RecruitmentDomainError";
    this.code = code;
    this.details = details;
  }
}

export function toPermissionError(error: RecruitmentDomainError): PermissionError {
  return new PermissionError(error.message);
}

export function isRecruitmentDomainError(error: unknown): error is RecruitmentDomainError {
  return error instanceof RecruitmentDomainError;
}
