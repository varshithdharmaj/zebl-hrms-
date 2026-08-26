import { JobOpeningStatus } from "@/generated/prisma/enums";

const DAY_MS = 86_400_000;

/** Compact duration like "4d", "18d", "2mo", "1y". Always >= 0. */
export function formatDurationShort(ms: number): string {
  const days = Math.floor(Math.max(ms, 0) / DAY_MS);
  if (days < 1) return "Today";
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  // Derive years from months (not days/365) so the two thresholds agree —
  // computing years independently from days could yield e.g. 12mo and 0y
  // for the same ~360-364 day span.
  return `${Math.floor(months / 12)}y`;
}

/**
 * Recruiter-facing "Age" for a job opening row: time since it was created,
 * or "Closed after Xd" once the job has actually closed.
 */
export function formatJobOpeningAge(job: {
  createdAt: Date;
  status: JobOpeningStatus;
  closedAt: Date | null;
}): string {
  if (job.status === JobOpeningStatus.closed && job.closedAt) {
    return `Closed after ${formatDurationShort(job.closedAt.getTime() - job.createdAt.getTime())}`;
  }
  return formatDurationShort(Date.now() - job.createdAt.getTime());
}
