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
import type {
  ApplicationDetail,
  ApplicationDetailRow,
  ApplicationListFilters,
  ApplicationRepository,
} from "@/lib/recruitment/repositories/application-repository";
import type {
  SearchFilters,
  CursorPaginationInput,
  PaginationInput,
} from "@/lib/recruitment/repositories/types";

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

/** Lean include for list/search — omits stageHistory + documents (detail-only). */
const listInclude = {
  candidate: {
    include: {
      personal: true,
    },
  },
  jobOpening: true,
  assignedRecruiter: { select: { id: true, email: true } },
  assignedManager: { select: { id: true, name: true } },
  createdBy: { select: { id: true, email: true } },
  assessmentUpdatedBy: { select: { id: true, email: true } },
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
function mapApplicationRow(row: ApplicationDetailRow): ApplicationDetail {
  const { candidate, jobOpening, ...rest } = row;

  return {
    ...rest,
    candidate: candidate
      ? {
          ...candidate,
          currentCtc: decimalToNumber(candidate.currentCtc),
          expectedCtc: decimalToNumber(candidate.expectedCtc),
        }
      : candidate,
    jobOpening: jobOpening
      ? {
          ...jobOpening,
          compensationMin: decimalToNumber(jobOpening.compensationMin),
          compensationMax: decimalToNumber(jobOpening.compensationMax),
        }
      : jobOpening,
  };
}

function toPagePagination(
  input: PaginationInput | CursorPaginationInput
): Partial<PaginationInput> {
  if ("page" in input) return input;
  return { page: 1, pageSize: input.limit };
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

function readStringFilter(
  filters: ApplicationListFilters | SearchFilters | undefined,
  key: string
): string | undefined {
  if (!filters) return undefined;
  const value = (filters as SearchFilters)[key];
  return typeof value === "string" ? value : undefined;
}

function readNumberFilter(
  filters: ApplicationListFilters | SearchFilters | undefined,
  key: string
): number | undefined {
  if (!filters) return undefined;
  const value = (filters as SearchFilters)[key];
  return typeof value === "number" ? value : undefined;
}

function filtersWhere(
  filters?: ApplicationListFilters | SearchFilters
): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput = {};
  if (!filters?.includeArchived) {
    where.deletedAt = null;
  }
  const jobOpeningId = readStringFilter(filters, "jobOpeningId");
  if (jobOpeningId) {
    where.jobOpeningId = jobOpeningId;
  }
  const candidateId = readStringFilter(filters, "candidateId");
  if (candidateId) {
    where.candidateId = candidateId;
  }
  const status = readStringFilter(filters, "status");
  if (status && status !== "all") {
    where.status = status as ApplicationStatus;
  }
  const currentStage = readStringFilter(filters, "currentStage");
  if (currentStage && currentStage !== "all") {
    where.currentStage = currentStage as RecruitmentPipelineStage;
  }
  const assignedRecruiterUserId = readStringFilter(filters, "assignedRecruiterUserId");
  if (assignedRecruiterUserId) {
    where.assignedRecruiterUserId = assignedRecruiterUserId;
  }
  const assignedManagerEmployeeId = readNumberFilter(filters, "assignedManagerEmployeeId");
  if (assignedManagerEmployeeId !== undefined) {
    where.assignedManagerEmployeeId = assignedManagerEmployeeId;
  }
  const priority = readStringFilter(filters, "priority");
  if (priority) {
    where.priority = priority as ApplicationPriority;
  }
  const q = readStringFilter(filters, "q");
  if (q?.trim()) {
    const trimmed = q.trim();
    where.OR = [
      {
        candidate: {
          OR: [
            { fullName: { contains: trimmed, mode: "insensitive" } },
            { email: { contains: trimmed, mode: "insensitive" } },
          ],
        },
      },
      {
        jobOpening: {
          title: { contains: trimmed, mode: "insensitive" },
        },
      },
    ];
  }
  return where;
}

function mergeWhere(
  scope: RecruitmentScope,
  filters?: ApplicationListFilters | SearchFilters
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
    return row ? mapApplicationRow(row) : null;
  },

  async findByCandidate(candidateId) {
    const rows = await prisma.application.findMany({
      where: { candidateId, deletedAt: null },
      include: detailInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => mapApplicationRow(row));
  },

  async findByJob(jobOpeningId) {
    const rows = await prisma.application.findMany({
      where: { jobOpeningId, deletedAt: null },
      include: detailInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => mapApplicationRow(row));
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
    return row ? mapApplicationRow(row) : null;
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
        include: listInclude,
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
        orderBy: { [sortField]: sortDirection },
      }),
    ]);

    return toPageResult(
      rows.map((row) =>
        mapApplicationRow({
          ...row,
          stageHistory: [],
          candidate: row.candidate
            ? { ...row.candidate, documents: [] }
            : row.candidate,
        } as ApplicationDetailRow)
      ),
      total,
      pagination
    );
  },

  async searchApplications(args) {
    const pagination = normalizePagination(toPagePagination(args.pagination));
    const where = mergeWhere(args.scope, { q: args.query });

    const [total, rows] = await prisma.$transaction([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        include: listInclude,
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return toPageResult(
      rows.map((row) =>
        mapApplicationRow({
          ...row,
          stageHistory: [],
          candidate: row.candidate
            ? { ...row.candidate, documents: [] }
            : row.candidate,
        } as ApplicationDetailRow)
      ),
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
    return mapApplicationRow(row);
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
