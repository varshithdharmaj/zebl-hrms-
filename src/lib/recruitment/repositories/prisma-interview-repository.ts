import { Prisma } from "@/generated/prisma/client";
import {
  InterviewRoundType,
  InterviewStatus,
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
  InterviewDetail,
  InterviewDetailRow,
  InterviewListFilters,
  InterviewRepository,
} from "@/lib/recruitment/repositories/interview-repository";
import type {
  SearchFilters,
  CursorPaginationInput,
  PaginationInput,
} from "@/lib/recruitment/repositories/types";

type Client = RepositoryTx;

const detailInclude = {
  application: {
    include: {
      candidate: true,
      jobOpening: true,
    },
  },
  panelists: {
    include: {
      employee: {
        select: { id: true, name: true, user: { select: { id: true, email: true } } },
      },
    },
  },
  feedback: {
    include: {
      author: {
        select: { id: true, name: true, user: { select: { id: true, email: true } } },
      },
    },
  },
  attachments: {
    where: { deletedAt: null },
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
function mapInterviewRow(row: InterviewDetailRow): InterviewDetail {
  const { application, ...rest } = row;
  if (!application) {
    return { ...rest, application: null };
  }

  const { candidate, jobOpening, ...applicationRest } = application;

  return {
    ...rest,
    application: {
      ...applicationRest,
      candidate: candidate
        ? {
            ...candidate,
            currentCtc: decimalToNumber(candidate.currentCtc),
            expectedCtc: decimalToNumber(candidate.expectedCtc),
            totalExperienceYears: decimalToNumber(candidate.totalExperienceYears),
          }
        : candidate,
      jobOpening: jobOpening
        ? {
            ...jobOpening,
            compensationMin: decimalToNumber(jobOpening.compensationMin),
            compensationMax: decimalToNumber(jobOpening.compensationMax),
          }
        : jobOpening,
    },
  };
}

function readStringFilter(
  filters: InterviewListFilters | SearchFilters | undefined,
  key: string
): string | undefined {
  if (!filters) return undefined;
  const value = (filters as SearchFilters)[key];
  return typeof value === "string" ? value : undefined;
}

function toPagePagination(
  input: PaginationInput | CursorPaginationInput
): Partial<PaginationInput> {
  if ("page" in input) return input;
  return { page: 1, pageSize: input.limit };
}

function scopeWhere(scope: RecruitmentScope): Prisma.InterviewWhereInput {
  if (scope.mode === "unrestricted") return {};
  return {
    OR: [
      { applicationId: { in: [...scope.applicationIds] } },
      {
        application: {
          OR: [
            { jobOpeningId: { in: [...scope.jobOpeningIds] } },
            { candidateId: { in: [...scope.candidateIds] } },
          ],
        },
      },
    ],
  };
}

function filtersWhere(
  filters?: InterviewListFilters | SearchFilters
): Prisma.InterviewWhereInput {
  const where: Prisma.InterviewWhereInput = {};
  if (!filters?.includeArchived) {
    where.deletedAt = null;
  }
  const status = readStringFilter(filters, "status");
  if (status && status !== "all") {
    where.status = status as InterviewStatus;
  }
  const roundType = readStringFilter(filters, "roundType");
  if (roundType && roundType !== "all") {
    where.roundType = roundType as InterviewRoundType;
  }
  const applicationId = readStringFilter(filters, "applicationId");
  if (applicationId) {
    where.applicationId = applicationId;
  }
  const candidateId = readStringFilter(filters, "candidateId");
  if (candidateId) {
    const applicationFilter: Prisma.ApplicationWhereInput = { candidateId };
    where.application = applicationFilter;
  }
  const q = readStringFilter(filters, "q");
  if (q?.trim()) {
    const trimmed = q.trim();
    where.OR = [
      {
        application: {
          candidate: {
            fullName: { contains: trimmed, mode: "insensitive" },
          },
        },
      },
      {
        title: { contains: trimmed, mode: "insensitive" },
      },
    ];
  }
  return where;
}

function mergeWhere(
  scope: RecruitmentScope,
  filters?: InterviewListFilters | SearchFilters
): Prisma.InterviewWhereInput {
  return {
    AND: [scopeWhere(scope), filtersWhere(filters)],
  };
}

export const prismaInterviewRepository: InterviewRepository = {
  async createInterview(data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.interview.create({
      data: {
        applicationId: data.applicationId,
        roundType: data.roundType,
        status: data.status ?? InterviewStatus.scheduled,
        title: data.title ?? null,
        scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : null,
        scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : null,
        timezone: data.timezone ?? null,
        location: data.location ?? null,
        meetingUrl: data.meetingUrl ?? null,
        summary: data.summary ?? null,
        createdByUserId: data.createdByUserId ?? null,
      },
    });

    if (data.panelistEmployeeIds && data.panelistEmployeeIds.length > 0) {
      await client.interviewPanelist.createMany({
        data: data.panelistEmployeeIds.map((empId: number) => ({
          interviewId: created.id,
          employeeId: empId,
        })),
      });
    }

    return { id: created.id };
  },

  async updateInterview(id, patch, tx) {
    const client: Client = tx ?? prisma;
    await client.interview.update({
      where: { id },
      data: {
        roundType: patch.roundType,
        status: patch.status,
        title: patch.title,
        scheduledStart: patch.scheduledStart ? new Date(patch.scheduledStart) : null,
        scheduledEnd: patch.scheduledEnd ? new Date(patch.scheduledEnd) : null,
        timezone: patch.timezone,
        location: patch.location,
        meetingUrl: patch.meetingUrl,
        summary: patch.summary,
      },
    });

    if (patch.panelistEmployeeIds) {
      await this.replacePanelists(id, patch.panelistEmployeeIds, client);
    }
  },

  async archiveInterview(id, tx) {
    const client: Client = tx ?? prisma;
    await client.interview.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async restoreInterview(id, tx) {
    const client: Client = tx ?? prisma;
    await client.interview.update({
      where: { id },
      data: { deletedAt: null },
    });
  },

  async getInterview(id) {
    const row = await prisma.interview.findUnique({
      where: { id },
      include: detailInclude,
    });
    return row ? mapInterviewRow(row) : null;
  },

  async listInterviews(args) {
    const pagination = normalizePagination(args.pagination);
    const where = mergeWhere(args.scope, args.filters);

    const sortField = args.sort?.field ?? "scheduledStart";
    const sortDirection = args.sort?.direction ?? "asc";

    const [total, rows] = await prisma.$transaction([
      prisma.interview.count({ where }),
      prisma.interview.findMany({
        where,
        include: detailInclude,
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
        orderBy: { [sortField]: sortDirection },
      }),
    ]);

    return toPageResult(
      rows.map((row) => mapInterviewRow(row)),
      total,
      pagination
    );
  },

  async searchInterviews(args) {
    const pagination = normalizePagination(toPagePagination(args.pagination));
    const where = mergeWhere(args.scope, { q: args.query });

    const [total, rows] = await prisma.$transaction([
      prisma.interview.count({ where }),
      prisma.interview.findMany({
        where,
        include: detailInclude,
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
        orderBy: { scheduledStart: "asc" },
      }),
    ]);

    return toPageResult(
      rows.map((row) => mapInterviewRow(row)),
      total,
      pagination
    );
  },

  async listByApplication(applicationId) {
    const rows = await prisma.interview.findMany({
      where: { applicationId, deletedAt: null },
      include: detailInclude,
      orderBy: { scheduledStart: "asc" },
    });
    return rows.map((row) => mapInterviewRow(row));
  },

  async listByScheduleRange(args) {
    const pagination = normalizePagination(args.pagination);
    const where = mergeWhere(args.scope, {
      ...args.filters,
      scheduledStart: {
        gte: args.rangeStart,
        lte: args.rangeEnd,
      },
    } as InterviewListFilters);

    const [total, rows] = await prisma.$transaction([
      prisma.interview.count({ where }),
      prisma.interview.findMany({
        where,
        include: detailInclude,
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
        orderBy: { scheduledStart: "asc" },
      }),
    ]);

    return toPageResult(
      rows.map((row) => mapInterviewRow(row)),
      total,
      pagination
    );
  },

  async replacePanelists(interviewId, employeeIds, tx) {
    const client: Client = tx ?? prisma;
    await client.interviewPanelist.deleteMany({
      where: { interviewId },
    });
    if (employeeIds.length > 0) {
      await client.interviewPanelist.createMany({
        data: employeeIds.map((empId) => ({
          interviewId,
          employeeId: empId,
        })),
      });
    }
  },

  async addAttachment(interviewId, data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.interviewAttachment.create({
      data: {
        interviewId,
        fileName: data.fileName,
        mimeType: data.mimeType ?? null,
        sizeBytes: data.sizeBytes ?? null,
        storageKey: data.storageKey,
        uploadedByUserId: data.uploadedByUserId ?? null,
      },
    });
    return { id: created.id };
  },

  async softDeleteAttachment(attachmentId, tx) {
    const client: Client = tx ?? prisma;
    await client.interviewAttachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });
  },

  async submitFeedback(interviewId, authorEmployeeId, data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.interviewFeedback.upsert({
      where: {
        interviewId_authorEmployeeId: {
          interviewId,
          authorEmployeeId,
        },
      },
      create: {
        interviewId,
        authorEmployeeId,
        overallRating: data.overallRating ?? null,
        ratingsJson: data.ratingsJson ?? {},
        recommendation: data.recommendation ?? null,
        strengths: data.strengths ?? null,
        concerns: data.concerns ?? null,
        privateNotes: data.privateNotes ?? null,
        submittedAt: new Date(),
      },
      update: {
        overallRating: data.overallRating ?? null,
        ratingsJson: data.ratingsJson ?? {},
        recommendation: data.recommendation ?? null,
        strengths: data.strengths ?? null,
        concerns: data.concerns ?? null,
        privateNotes: data.privateNotes ?? null,
        submittedAt: new Date(),
      },
    });
    return { id: created.id };
  },

  async listFeedback(interviewId) {
    const rows = await prisma.interviewFeedback.findMany({
      where: { interviewId },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
    return rows;
  },

  async findFeedback(feedbackId) {
    const row = await prisma.interviewFeedback.findUnique({
      where: { id: feedbackId },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
    return row;
  },

  async countInterviews(scope, filters) {
    const where = mergeWhere(scope, filters);

    const [statusCounts, roundCounts] = await Promise.all([
      prisma.interview.groupBy({
        by: ["status"],
        where,
        _count: { id: true },
      }),
      prisma.interview.groupBy({
        by: ["roundType"],
        where,
        _count: { id: true },
      }),
    ]);

    const result: Record<string, number> = {};
    statusCounts.forEach((c) => {
      result[`status_${c.status}`] = c._count.id;
    });
    roundCounts.forEach((c) => {
      result[`round_${c.roundType}`] = c._count.id;
    });

    result["total"] = await prisma.interview.count({ where });

    return result;
  },
};
