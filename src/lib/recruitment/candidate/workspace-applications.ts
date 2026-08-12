import type { ApplicationDetail } from "@/lib/recruitment/repositories/application-repository";

export type CandidateWorkspaceApplicationRow = {
  id: string;
  status: string;
  currentStage: string;
  jobOpeningId: string;
  jobTitle: string;
  createdAt: Date | string;
};

export function mapWorkspaceApplicationRow(
  item: ApplicationDetail | Record<string, unknown>
): CandidateWorkspaceApplicationRow {
  const jobOpening = (item as { jobOpening?: { id?: string; title?: string } }).jobOpening;
  return {
    id: String(item.id),
    status: String((item as { status?: string }).status ?? ""),
    currentStage: String((item as { currentStage?: string }).currentStage ?? ""),
    jobOpeningId: String(
      (item as { jobOpeningId?: string }).jobOpeningId ?? jobOpening?.id ?? ""
    ),
    jobTitle: String(jobOpening?.title ?? "Job"),
    createdAt: (item as { createdAt: Date | string }).createdAt,
  };
}
