import type { InterviewListItem } from "@/lib/recruitment/repositories/interview-repository";

export type CandidateWorkspaceInterviewRow = {
  id: string;
  title: string;
  scheduledStart: Date | string;
  roundType: string;
  status: string;
  applicationId: string | null;
  jobOpeningId: string | null;
  jobTitle: string | null;
};

/**
 * Map list interviews for Candidate Workspace — preserve Application → Job attribution.
 * Uses relations already loaded by the interview list query (no extra fetches).
 */
export function mapWorkspaceInterviewRow(
  item: InterviewListItem | Record<string, unknown>
): CandidateWorkspaceInterviewRow {
  const application = (item as { application?: {
    id?: string;
    jobOpeningId?: string;
    jobOpening?: { id?: string; title?: string | null } | null;
  } | null }).application;

  const jobOpening = application?.jobOpening ?? null;
  const jobTitle =
    typeof jobOpening?.title === "string" && jobOpening.title.trim().length > 0
      ? jobOpening.title
      : null;

  return {
    id: String((item as { id: string }).id),
    title: String((item as { title?: string | null }).title ?? "Interview"),
    scheduledStart: (item as { scheduledStart: Date | string }).scheduledStart,
    roundType: String((item as { roundType?: string }).roundType ?? "round"),
    status: String((item as { status?: string }).status ?? "scheduled"),
    applicationId: application?.id ? String(application.id) : null,
    jobOpeningId: jobOpening?.id
      ? String(jobOpening.id)
      : application?.jobOpeningId
        ? String(application.jobOpeningId)
        : null,
    jobTitle,
  };
}
