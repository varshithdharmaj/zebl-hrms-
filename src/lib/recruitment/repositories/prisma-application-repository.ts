import { Prisma } from "@/generated/prisma/client";
import {
  ApplicationPriority,
  ApplicationStatus,
  RecruitmentPipelineStage,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import {
  normalizePagination,
  paginationSkip,
  toPageResult,
} from "@/lib/recruitment/shared/pagination";
import type { ApplicationRepository } from "@/lib/recruitment/repositories/application-repository";
import type { ScopedListArgs, ScopedSearchArgs } from "@/lib/recruitment/repositories/types";

type Client = RepositoryTx;

const detailInclude = {
  candidate: {
    include: {
      personal: true,
      documents: { where: { deletedAt: null } },
    },
  },
  jobOpening: true,
  assignedRecruiter: { select: { id: true, email: true } },
  assignedManager: { select: { id: true, name: true } },
  createdBy: { select: { id: true, email: true } },
  assessmentUpdatedBy: { select: { id: true, email: true } },
  stageHistory: {
    orderBy: { createdAt: "desc" as const },
    include: {
      actor: { select: { id: true, email: true } },
    },
  },
} as const;

function decimalToNumber(
  value: Prisma.Decimal | number | string | null | undefined
): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return Number(value.toString());
}

/** Strip Prisma.Decimal so RSC → client props stay plain JSON-safe. */
function mapApplicationRow<T extends Record<string, unknown>>(row: T): T {
  const candidate = (row as { candidate?: Record<string, unknown> | null }).candidate;
  const jobOpening = (row as { jobOpening?: Record<string, unknown> | null }).jobOpening;

  return {
    ...row,
    candidate: candidate
      ? {
          ...candidate,
          currentCtc: decimalToNumber(candidate.currentCtc as Prisma.Decimal | null),
          expectedCtc: decimalToNumber(candidate.expectedCtc as Prisma.Decimal | null),
        }
      : candidate,
    jobOpening: jobOpening
      ? {
          ...jobOpening,
          compensationMin: decimalToNumber(
            jobOpening.compensationMin as Prisma.Decimal | null
          ),
          compensationMax: decimalToNumber(
            jobOpening.compensationMax as Prisma.Decimal | null
          ),
        }
      : jobOpening,
  };
}

function scopeWhere(scope: RecruitmentScope): Prisma.ApplicationWhereInput {
  if (scope.mode === "unrestricted") return {};
  return {
    OR: [
      { id: { in: [...scope.applicationIds] } },
      { jobOpeningId: { in: [...scope.jobOpeningIds] } },
      { candidateId: { in: [...scope.candidateIds] } },
    ],
  };
}

function filtersWhere(filters?: any): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput = {};
  if (!filters?.includeArchived) {
    where.deletedAt = null;
  }
  if (filters?.jobOpeningId) {
    where.jobOpeningId = filters.jobOpeningId;
  }
  if (filters?.candidateId) {
    where.candidateId = filters.candidateId;
  }
  if (filters?.status && filters.status !== "all") {
    where.status = filters.status;
  }
  if (filters?.currentStage && filters.currentStage !== "all") {
    where.currentStage = filters.currentStage;
  }
  if (filters?.assignedRecruiterUserId) {
    where.assignedRecruiterUserId = filters.assignedRecruiterUserId;
  }
  if (filters?.assignedManagerEmployeeId) {
    where.assignedManagerEmployeeId = filters.assignedManagerEmployeeId;
  }
  if (filters?.priority) {
    where.priority = filters.priority;
  }
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      {
        candidate: {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
      },
      {
        jobOpening: {
          title: { contains: q, mode: "insensitive" },
        },
      },
    ];
  }
  return where;
}

function mergeWhere(
  scope: RecruitmentScope,
  filters?: any
): Prisma.ApplicationWhereInput {
  return {
    AND: [scopeWhere(scope), filtersWhere(filters)],
  };
}

export const prismaApplicationRepository: ApplicationRepository = {
  async createApplication(data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.application.create({
      data: {
        candidateId: data.candidateId,
        jobOpeningId: data.jobOpeningId,
        status: data.status ?? ApplicationStatus.active,
        currentStage: data.currentStage ?? RecruitmentPipelineStage.resume_received,
        stageEnteredAt: data.stageEnteredAt ?? new Date(),
        priority: data.priority ?? ApplicationPriority.normal,
        assignedRecruiterUserId: data.assignedRecruiterUserId ?? null,
        assignedManagerEmployeeId: data.assignedManagerEmployeeId ?? null,
        source: data.source ?? null,
        riskFlagsJson: data.riskFlagsJson ?? "[]",
        aggregateScore: data.aggregateScore ?? null,
        createdByUserId: data.createdByUserId ?? null,
      },
    });
    return { id: created.id };
  },

  async updateApplication(id, patch, tx) {
    const client: Client = tx ?? prisma;
    await client.application.update({
      where: { id },
      data: {
        status: patch.status,
        currentStage: patch.currentStage,
        stageEnteredAt: patch.stageEnteredAt,
        priority: patch.priority,
        assignedRecruiterUserId: patch.assignedRecruiterUserId,
        assignedManagerEmployeeId: patch.assignedManagerEmployeeId,
        source: patch.source,
        riskFlagsJson: patch.riskFlagsJson,
        aggregateScore: patch.aggregateScore,
        rejectedReason: patch.rejectedReason,
        holdReason: patch.holdReason,
        withdrawnReason: patch.withdrawnReason,
      },
    });
  },

  async archiveApplication(id, tx) {
    const client: Client = tx ?? prisma;
    await client.application.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async restoreApplication(id, tx) {
    const client: Client = tx ?? prisma;
    await client.application.update({
      where: { id },
      data: { deletedAt: null },
    });
  },

  async getApplication(id) {
    const row = await prisma.application.findUnique({
      where: { id },
      include: detailInclude,
    });
    return row ? mapApplicationRow(row as any) : null;
  },

  async findByCandidate(candidateId) {
    const rows = await prisma.application.findMany({
      where: { candidateId, deletedAt: null },
      include: detailInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => mapApplicationRow(row as any));
  },

  async findByJob(jobOpeningId) {
    const rows = await prisma.application.findMany({
      where: { jobOpeningId, deletedAt: null },
      include: detailInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => mapApplicationRow(row as any));
  },

  async findActiveByCandidateAndJob(candidateId, jobOpeningId) {
    const row = await prisma.application.findFirst({
      where: {
        candidateId,
        jobOpeningId,
        deletedAt: null,
        status: { in: [ApplicationStatus.active, ApplicationStatus.on_hold] },
      },
      include: detailInclude,
    });
    return row ? mapApplicationRow(row as any) : null;
  },

  async listApplications(args) {
    const pagination = normalizePagination(args.pagination);
    const where = mergeWhere(args.scope, args.filters);

    const sortField = args.sort?.field ?? "createdAt";
    const sortDirection = args.sort?.direction ?? "desc";

    const [total, rows] = await prisma.$transaction([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        include: detailInclude,
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
        orderBy: { [sortField]: sortDirection },
      }),
    ]);

    return toPageResult(
      rows.map((row) => mapApplicationRow(row as any)),
      total,
      pagination
    );
  },

  async searchApplications(args) {
    const pagination = normalizePagination(args.pagination);
    const where = mergeWhere(args.scope, { q: args.query });

    const [total, rows] = await prisma.$transaction([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        include: detailInclude,
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return toPageResult(
      rows.map((row) => mapApplicationRow(row as any)),
      total,
      pagination
    );
  },

  async assignRecruiter(id, recruiterUserId, tx) {
    const client: Client = tx ?? prisma;
    await client.application.update({
      where: { id },
      data: { assignedRecruiterUserId: recruiterUserId },
    });
  },

  async assignManager(id, managerEmployeeId, tx) {
    const client: Client = tx ?? prisma;
    await client.application.update({
      where: { id },
      data: { assignedManagerEmployeeId: managerEmployeeId },
    });
  },

  async setPriority(id, priority, tx) {
    const client: Client = tx ?? prisma;
    await client.application.update({
      where: { id },
      data: { priority },
    });
  },

  async setStatus(id, status, tx) {
    const client: Client = tx ?? prisma;
    await client.application.update({
      where: { id },
      data: { status },
    });
  },

  async setAggregateScore(id, score, tx) {
    const client: Client = tx ?? prisma;
    await client.application.update({
      where: { id },
      data: { aggregateScore: score },
    });
  },

  async updateAssessment(id, data, tx) {
    const client: Client = tx ?? prisma;
    const row = await client.application.update({
      where: { id },
      data: {
        assessment: data.assessment,
        assessmentUpdatedAt: data.assessmentUpdatedAt,
        assessmentUpdatedByUserId: data.assessmentUpdatedByUserId,
      },
      include: detailInclude,
    });
    return mapApplicationRow(row as any);
  },

  async moveApplicationStage(id, stage, stageEnteredAt, status, tx) {
    const client: Client = tx ?? prisma;
    await client.application.update({
      where: { id },
      data: {
        currentStage: stage,
        stageEnteredAt,
        status: status ?? undefined,
      },
    });
    // Stage history is written by ApplicationService.moveToStage (with actor + note).
  },

  async countApplications(scope, filters) {
    const where = mergeWhere(scope, filters);

    // Run parallel counts for dashboard metrics
    const [statusCounts, stageCounts, recruiterCounts, sourceCounts] = await Promise.all([
      prisma.application.groupBy({
        by: ["status"],
        where,
        _count: { id: true },
      }),
      prisma.application.groupBy({
        by: ["currentStage"],
        where,
        _count: { id: true },
      }),
      prisma.application.groupBy({
        by: ["assignedRecruiterUserId"],
        where,
        _count: { id: true },
      }),
      prisma.application.groupBy({
        by: ["source"],
        where,
        _count: { id: true },
      }),
    ]);

    const result: Record<string, number> = {};

    statusCounts.forEach((c) => {
      result[`status_${c.status}`] = c._count.id;
    });
    stageCounts.forEach((c) => {
      result[`stage_${c.currentStage}`] = c._count.id;
    });
    recruiterCounts.forEach((c) => {
      if (c.assignedRecruiterUserId) {
        result[`recruiter_${c.assignedRecruiterUserId}`] = c._count.id;
      }
    });
    sourceCounts.forEach((c) => {
      if (c.source) {
        result[`source_${c.source}`] = c._count.id;
      }
    });

    // Total count
    result["total"] = await prisma.application.count({ where });

    return result;
  },
};
