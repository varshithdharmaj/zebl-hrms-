import type { RecruitmentTimelineEntityType } from "@/generated/prisma/enums";

export type TimelineItem = {
  id: string;
  entityType: RecruitmentTimelineEntityType;
  entityId: string;
  applicationId: string | null;
  candidateId: string | null;
  jobOpeningId: string | null;
  eventType: string;
  summary: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type AppendTimelineInput = {
  entityType: RecruitmentTimelineEntityType;
  entityId: string;
  eventType: string;
  summary: string;
  actorUserId?: string | null;
  applicationId?: string | null;
  candidateId?: string | null;
  jobOpeningId?: string | null;
  metadata?: Record<string, unknown>;
};
