import type { RecruitmentTimelineEntityType } from "@/generated/prisma/enums";
import type { AppendTimelineInput, TimelineItem } from "@/lib/recruitment/types/timeline";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";

export type TimelineListFilter = {
  entityType?: RecruitmentTimelineEntityType;
  entityId?: string;
  applicationId?: string;
  candidateId?: string;
  jobOpeningId?: string;
  limit?: number;
};

/** Consumer-owned projection store — Phase 1 has Prisma implementation. */
export type TimelineProjectionRepository = {
  append(input: AppendTimelineInput, tx?: RepositoryTx): Promise<TimelineItem>;
  list(filter: TimelineListFilter): Promise<readonly TimelineItem[]>;
  listByEntity(
    entityType: RecruitmentTimelineEntityType,
    entityId: string,
    limit?: number
  ): Promise<readonly TimelineItem[]>;
  listByCandidate(candidateId: string, limit?: number): Promise<readonly TimelineItem[]>;
  listByApplication(applicationId: string, limit?: number): Promise<readonly TimelineItem[]>;
};
