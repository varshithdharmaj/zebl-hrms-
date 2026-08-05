import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { RecruitmentTimelineEntityType } from "@/generated/prisma/enums";
import type { AppendTimelineInput, TimelineItem } from "@/lib/recruitment/types/timeline";
import type {
  TimelineListFilter,
  TimelineProjectionRepository,
} from "@/lib/recruitment/repositories/timeline-repository";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";

function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapRow(row: {
  id: string;
  entityType: RecruitmentTimelineEntityType;
  entityId: string;
  applicationId: string | null;
  candidateId: string | null;
  jobOpeningId: string | null;
  eventType: string;
  summary: string;
  actorUserId: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}): TimelineItem {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    applicationId: row.applicationId,
    candidateId: row.candidateId,
    jobOpeningId: row.jobOpeningId,
    eventType: row.eventType,
    summary: row.summary,
    actorUserId: row.actorUserId,
    metadata: jsonRecord(row.metadata),
    createdAt: row.createdAt,
  };
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function clampLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(limit));
}

export const prismaTimelineProjectionRepository: TimelineProjectionRepository = {
  async append(input: AppendTimelineInput, tx?: RepositoryTx): Promise<TimelineItem> {
    const client = tx ?? prisma;
    const row = await client.recruitmentTimelineEvent.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        applicationId: input.applicationId ?? null,
        candidateId: input.candidateId ?? null,
        jobOpeningId: input.jobOpeningId ?? null,
        eventType: input.eventType,
        summary: input.summary,
        actorUserId: input.actorUserId ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return mapRow(row);
  },

  async list(filter: TimelineListFilter): Promise<readonly TimelineItem[]> {
    const rows = await prisma.recruitmentTimelineEvent.findMany({
      where: {
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.entityId ? { entityId: filter.entityId } : {}),
        ...(filter.applicationId ? { applicationId: filter.applicationId } : {}),
        ...(filter.candidateId ? { candidateId: filter.candidateId } : {}),
        ...(filter.jobOpeningId ? { jobOpeningId: filter.jobOpeningId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: clampLimit(filter.limit),
    });
    return rows.map(mapRow);
  },

  async listByEntity(
    entityType: RecruitmentTimelineEntityType,
    entityId: string,
    limit?: number
  ): Promise<readonly TimelineItem[]> {
    return prismaTimelineProjectionRepository.list({ entityType, entityId, limit });
  },

  async listByCandidate(candidateId: string, limit?: number): Promise<readonly TimelineItem[]> {
    return prismaTimelineProjectionRepository.list({ candidateId, limit });
  },

  async listByApplication(
    applicationId: string,
    limit?: number
  ): Promise<readonly TimelineItem[]> {
    return prismaTimelineProjectionRepository.list({ applicationId, limit });
  },
};
