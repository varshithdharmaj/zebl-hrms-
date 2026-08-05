import type { AppendTimelineInput, TimelineItem } from "@/lib/recruitment/types/timeline";
import type { TimelineListFilter } from "@/lib/recruitment/repositories/timeline-repository";
import { prismaTimelineProjectionRepository } from "@/lib/recruitment/repositories/prisma-timeline-repository";
import type { TimelineProjectionRepository } from "@/lib/recruitment/repositories/timeline-repository";

/**
 * Operational timeline projection service.
 * Audit log remains source of truth; this store is for UI timelines.
 */
export function createRecruitmentTimelineService(
  repository: TimelineProjectionRepository = prismaTimelineProjectionRepository
) {
  return {
    append(input: AppendTimelineInput): Promise<TimelineItem> {
      return repository.append(input);
    },

    list(filter: TimelineListFilter): Promise<readonly TimelineItem[]> {
      return repository.list(filter);
    },

    /**
     * Build a timeline for a workspace surface (application / candidate / job / entity).
     * Newest first.
     */
    buildTimeline(filter: TimelineListFilter): Promise<readonly TimelineItem[]> {
      return repository.list(filter);
    },
  };
}

export const RecruitmentTimelineService = createRecruitmentTimelineService();
