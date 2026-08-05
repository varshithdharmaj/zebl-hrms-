import { JobOpeningStatus } from "@/generated/prisma/enums";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

const ALLOWED: Record<JobOpeningStatus, readonly JobOpeningStatus[]> = {
  draft: ["open", "closed"],
  open: ["on_hold", "closed", "filled"],
  on_hold: ["open", "closed"],
  closed: ["open"],
  filled: ["open"],
};

export function assertJobStatusTransition(
  from: JobOpeningStatus,
  to: JobOpeningStatus
): void {
  if (from === to) return;
  const allowed = ALLOWED[from];
  if (!allowed.includes(to)) {
    throw new RecruitmentDomainError(
      "REC_JOB_ILLEGAL_STATUS",
      `Cannot change job status from ${from} to ${to}.`
    );
  }
}

export function isJobStatusTransitionAllowed(
  from: JobOpeningStatus,
  to: JobOpeningStatus
): boolean {
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

export function timestampsForStatus(
  to: JobOpeningStatus,
  now = new Date()
): {
  publishedAt?: Date | null;
  closedAt?: Date | null;
  filledAt?: Date | null;
} {
  switch (to) {
    case "open":
      return { publishedAt: now, closedAt: null, filledAt: null };
    case "closed":
      return { closedAt: now, filledAt: null };
    case "filled":
      return { filledAt: now, closedAt: null };
    case "draft":
      return { publishedAt: null, closedAt: null, filledAt: null };
    case "on_hold":
      return {};
  }
}
