import { Prisma } from "@/generated/prisma/client";
import {
  HiringTeamRole,
  JobOpeningStatus,
  type NoteVisibility,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import {
  normalizePagination,
  paginationSkip,
  toPageResult,
} from "@/lib/recruitment/shared/pagination";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";
import { splitRequirements } from "@/lib/recruitment/job/requirements-skills";
import type {
  HiringTeamMemberInput,
  JobHiringTeamMemberView,
  JobListArgs,
  JobOpeningCreateData,
  JobOpeningDetail,
  JobOpeningListFilters,
  JobOpeningListItem,
  JobOpeningSort,
  JobOpeningStageView,
  JobOpeningUpdateData,
  JobRepository,
  JobSearchArgs,
  JobStageInput,
  JobStatusCounts,
} from "@/lib/recruitment/job/types";

type Client = RepositoryTx;

const listInclude = {
  ownerRecruiter: { select: { id: true, email: true } },
  hiringTeam: {
    where: { role: HiringTeamRole.hiring_manager },
    take: 1,
    include: {
      employee: { select: { id: true, name: true, employeeCode: true, department: true } },
    },
  },
  _count: { select: { applications: true } },
} as const;

function decimalToString(value: Prisma.Decimal | null | undefined): string | null {
  if (value == null) return null;
  return value.toString();
}

function scopeWhere(scope: RecruitmentScope): Prisma.JobOpeningWhereInput {
  if (scope.mode === "unrestricted") return {};
  if (scope.jobOpeningIds.length === 0) {
    return { id: { in: [] } };
  }
  return { id: { in: [...scope.jobOpeningIds] } };
}

function filtersWhere(filters?: JobOpeningListFilters): Prisma.JobOpeningWhereInput {
  const where: Prisma.JobOpeningWhereInput = {};
  if (!filters?.includeArchived) {
    where.deletedAt = null;
  }
  if (filters?.status && filters.status !== "all") {
    where.status = filters.status;
  }
  if (filters?.department?.trim()) {
    where.department = { equals: filters.department.trim(), mode: "insensitive" };
  }
  if (filters?.ownerRecruiterUserId) {
    where.ownerRecruiterUserId = filters.ownerRecruiterUserId;
  }
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { department: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

function mergeWhere(
  scope: RecruitmentScope,
  filters?: JobOpeningListFilters
): Prisma.JobOpeningWhereInput {
  return {
    AND: [scopeWhere(scope), filtersWhere(filters)],
  };
}

function orderBy(
  sort?: JobOpeningSort | { field: string; direction: "asc" | "desc" }
): Prisma.JobOpeningOrderByWithRelationInput {
  const field = sort?.field ?? "createdAt";
  const direction = sort?.direction ?? "desc";
  switch (field) {
    case "title":
      return { title: direction };
    case "status":
      return { status: direction };
    case "updatedAt":
      return { updatedAt: direction };
    case "closedAt":
      return { closedAt: direction };
    case "createdAt":
    default:
      return { createdAt: direction };
  }
}

function mapListItem(
  row: {
    id: string;
    title: string;
    code: string | null;
    status: JobOpeningStatus;
    department: string | null;
    location: string | null;
    openingsCount: number;
    employmentType: JobOpeningListItem["employmentType"];
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date | null;
    publishedAt: Date | null;
    targetStartDate: Date | null;
    deletedAt: Date | null;
    ownerRecruiterUserId: string | null;
    ownerRecruiter: { id: string; email: string } | null;
    hiringTeam: {
      employeeId: number;
      employee: { id: number; name: string; employeeCode: string; department: string | null };
    }[];
    _count: { applications: number };
    isPubliclyListed: boolean;
    publicSlug: string | null;
  }
): JobOpeningListItem {
  const hm = row.hiringTeam[0];
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    status: row.status,
    department: row.department,
    location: row.location,
    openingsCount: row.openingsCount,
    employmentType: row.employmentType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
    publishedAt: row.publishedAt,
    targetStartDate: row.targetStartDate,
    deletedAt: row.deletedAt,
    ownerRecruiterUserId: row.ownerRecruiterUserId,
    ownerRecruiterEmail: row.ownerRecruiter?.email ?? null,
    hiringManagerName: hm?.employee.name ?? null,
    hiringManagerEmployeeId: hm?.employeeId ?? null,
    applicationCount: row._count.applications,
    isPubliclyListed: row.isPubliclyListed,
    publicSlug: row.publicSlug,
  };
}

function mapTeamMember(row: {
  id: string;
  employeeId: number;
  role: HiringTeamRole;
  employee: { name: string; employeeCode: string; department: string | null };
}): JobHiringTeamMemberView {
  return {
    id: row.id,
    employeeId: row.employeeId,
    role: row.role,
    employeeName: row.employee.name,
    employeeCode: row.employee.employeeCode,
    department: row.employee.department,
  };
}

function mapStage(row: {
  id: string;
  stage: JobOpeningStageView["stage"];
  sortOrder: number;
  isOptional: boolean;
  isEnabled: boolean;
  label: string | null;
  slaDays: number | null;
}): JobOpeningStageView {
  return {
    id: row.id,
    stage: row.stage,
    sortOrder: row.sortOrder,
    isOptional: row.isOptional,
    isEnabled: row.isEnabled,
    label: row.label,
    slaDays: row.slaDays,
  };
}

function toCreateInput(data: JobOpeningCreateData): Prisma.JobOpeningCreateInput {
  return {
    title: data.title,
    code: data.code ?? null,
    status: data.status ?? JobOpeningStatus.draft,
    department: data.department ?? null,
    location: data.location ?? null,
    workMode: data.workMode ?? null,
    employmentType: data.employmentType,
    description: data.description ?? null,
    requirements: data.requirements ?? null,
    openingsCount: data.openingsCount,
    headcountApproved: data.headcountApproved ?? false,
    headcountRequestedBy:
      data.headcountRequestedByEmployeeId != null
        ? { connect: { id: data.headcountRequestedByEmployeeId } }
        : undefined,
    headcountRequestedAt: data.headcountRequestedAt ?? null,
    headcountUrgency: data.headcountUrgency ?? null,
    compensationCurrency: data.compensationCurrency ?? null,
    compensationMin:
      data.compensationMin != null && data.compensationMin !== ""
        ? new Prisma.Decimal(data.compensationMin)
        : null,
    compensationMax:
      data.compensationMax != null && data.compensationMax !== ""
        ? new Prisma.Decimal(data.compensationMax)
        : null,
    targetStartDate: data.targetStartDate ?? null,
    pipelineTemplate:
      data.pipelineTemplateId != null
        ? { connect: { id: data.pipelineTemplateId } }
        : undefined,
    ownerRecruiter:
      data.ownerRecruiterUserId != null
        ? { connect: { id: data.ownerRecruiterUserId } }
        : undefined,
    createdBy:
      data.createdByUserId != null ? { connect: { id: data.createdByUserId } } : undefined,
  };
}

function toUpdateInput(patch: JobOpeningUpdateData): Prisma.JobOpeningUpdateInput {
  const data: Prisma.JobOpeningUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.code !== undefined) data.code = patch.code;
  if (patch.department !== undefined) data.department = patch.department;
  if (patch.location !== undefined) data.location = patch.location;
  if (patch.workMode !== undefined) data.workMode = patch.workMode;
  if (patch.employmentType !== undefined) data.employmentType = patch.employmentType;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.requirements !== undefined) data.requirements = patch.requirements;
  if (patch.openingsCount !== undefined) data.openingsCount = patch.openingsCount;
  if (patch.headcountApproved !== undefined) data.headcountApproved = patch.headcountApproved;
  if (patch.headcountRequestedByEmployeeId !== undefined) {
    data.headcountRequestedBy =
      patch.headcountRequestedByEmployeeId == null
        ? { disconnect: true }
        : { connect: { id: patch.headcountRequestedByEmployeeId } };
  }
  if (patch.headcountRequestedAt !== undefined) {
    data.headcountRequestedAt = patch.headcountRequestedAt;
  }
  if (patch.headcountUrgency !== undefined) data.headcountUrgency = patch.headcountUrgency;
  if (patch.compensationCurrency !== undefined) {
    data.compensationCurrency = patch.compensationCurrency;
  }
  if (patch.compensationMin !== undefined) {
    data.compensationMin =
      patch.compensationMin != null && patch.compensationMin !== ""
        ? new Prisma.Decimal(patch.compensationMin)
        : null;
  }
  if (patch.compensationMax !== undefined) {
    data.compensationMax =
      patch.compensationMax != null && patch.compensationMax !== ""
        ? new Prisma.Decimal(patch.compensationMax)
        : null;
  }
  if (patch.targetStartDate !== undefined) data.targetStartDate = patch.targetStartDate;
  if (patch.pipelineTemplateId !== undefined) {
    data.pipelineTemplate =
      patch.pipelineTemplateId == null
        ? { disconnect: true }
        : { connect: { id: patch.pipelineTemplateId } };
  }
  if (patch.ownerRecruiterUserId !== undefined) {
    data.ownerRecruiter =
      patch.ownerRecruiterUserId == null
        ? { disconnect: true }
        : { connect: { id: patch.ownerRecruiterUserId } };
  }
  return data;
}

export const prismaJobRepository: JobRepository = {
  async createJob(data, stages, team = [], tx) {
    const client: Client = tx ?? prisma;
    const created = await client.jobOpening.create({
      data: {
        ...toCreateInput(data),
        stages: {
          create: stages.map((s: JobStageInput) => ({
            stage: s.stage,
            sortOrder: s.sortOrder,
            isOptional: s.isOptional ?? false,
            isEnabled: s.isEnabled ?? true,
            label: s.label ?? null,
            slaDays: s.slaDays ?? null,
          })),
        },
        hiringTeam:
          team.length > 0
            ? {
                create: team.map((m: HiringTeamMemberInput) => ({
                  employeeId: m.employeeId,
                  role: m.role,
                })),
              }
            : undefined,
      },
      select: { id: true },
    });
    return created;
  },

  async updateJob(id, patch, tx) {
    const client: Client = tx ?? prisma;
    await client.jobOpening.update({
      where: { id },
      data: toUpdateInput(patch),
    });
  },

  async archiveJob(id, tx) {
    const client: Client = tx ?? prisma;
    await client.jobOpening.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async reopenJob(id, status, timestamps, tx) {
    const client: Client = tx ?? prisma;
    await client.jobOpening.update({
      where: { id },
      data: {
        deletedAt: null,
        status,
        publishedAt: timestamps?.publishedAt,
        closedAt: timestamps?.closedAt,
        filledAt: timestamps?.filledAt,
      },
    });
  },

  async closeJob(id, closedAt, tx) {
    const client: Client = tx ?? prisma;
    await client.jobOpening.update({
      where: { id },
      data: {
        status: JobOpeningStatus.closed,
        closedAt,
        filledAt: null,
      },
    });
  },

  async changeStatus(id, status, meta, tx) {
    const client: Client = tx ?? prisma;
    await client.jobOpening.update({
      where: { id },
      data: {
        status,
        ...(meta.publishedAt !== undefined ? { publishedAt: meta.publishedAt } : {}),
        ...(meta.closedAt !== undefined ? { closedAt: meta.closedAt } : {}),
        ...(meta.filledAt !== undefined ? { filledAt: meta.filledAt } : {}),
      },
    });
  },

  async getJob(id, options) {
    const includeCompensation = options?.includeCompensation ?? false;
    const row = await prisma.jobOpening.findFirst({
      where: { id },
      include: {
        ownerRecruiter: { select: { id: true, email: true } },
        pipelineTemplate: { select: { id: true, name: true } },
        headcountRequestedBy: { select: { id: true, name: true } },
        stages: { orderBy: { sortOrder: "asc" } },
        hiringTeam: {
          include: {
            employee: {
              select: { id: true, name: true, employeeCode: true, department: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        notes: {
          where: { deletedAt: null },
          orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
          take: 20,
        },
        _count: { select: { applications: true } },
      },
    });
    if (!row) return null;

    const { requirements, skillsText } = splitRequirements(row.requirements);
    const hm = row.hiringTeam.find((m) => m.role === HiringTeamRole.hiring_manager);

    const detail: JobOpeningDetail = {
      id: row.id,
      title: row.title,
      code: row.code,
      status: row.status,
      department: row.department,
      location: row.location,
      openingsCount: row.openingsCount,
      employmentType: row.employmentType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      closedAt: row.closedAt,
      publishedAt: row.publishedAt,
      targetStartDate: row.targetStartDate,
      deletedAt: row.deletedAt,
      ownerRecruiterUserId: row.ownerRecruiterUserId,
      ownerRecruiterEmail: row.ownerRecruiter?.email ?? null,
      hiringManagerName: hm?.employee.name ?? null,
      hiringManagerEmployeeId: hm?.employeeId ?? null,
      applicationCount: row._count.applications,
      workMode: row.workMode,
      description: row.description,
      requirements,
      skillsText,
      headcountApproved: row.headcountApproved,
      headcountRequestedByEmployeeId: row.headcountRequestedByEmployeeId,
      headcountRequestedByName: row.headcountRequestedBy?.name ?? null,
      headcountRequestedAt: row.headcountRequestedAt,
      headcountUrgency: row.headcountUrgency,
      compensationCurrency: includeCompensation ? row.compensationCurrency : null,
      compensationMin: includeCompensation ? decimalToString(row.compensationMin) : null,
      compensationMax: includeCompensation ? decimalToString(row.compensationMax) : null,
      pipelineTemplateId: row.pipelineTemplateId,
      pipelineTemplateName: row.pipelineTemplate?.name ?? null,
      createdByUserId: row.createdByUserId,
      filledAt: row.filledAt,
      isPubliclyListed: row.isPubliclyListed,
      publicSlug: row.publicSlug,
      stages: row.stages.map(mapStage),
      hiringTeam: row.hiringTeam.map(mapTeamMember),
      notes: row.notes.map((n) => ({
        id: n.id,
        body: n.body,
        visibility: n.visibility,
        isPinned: n.isPinned,
        isResolved: n.isResolved,
        authorUserId: n.authorUserId,
        createdAt: n.createdAt,
      })),
    };
    return detail;
  },

  async listJobs(args) {
    const pagination = normalizePagination(args.pagination);
    const where = mergeWhere(args.scope, args.filters);
    const [total, rows] = await Promise.all([
      prisma.jobOpening.count({ where }),
      prisma.jobOpening.findMany({
        where,
        include: listInclude,
        orderBy: orderBy(args.sort),
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
      }),
    ]);
    return toPageResult(rows.map(mapListItem), total, pagination);
  },

  async countJobs(scope, filters) {
    const base = mergeWhere(scope, {
      includeArchived: filters?.includeArchived,
      department: filters?.department,
    });
    const [total, draft, open, on_hold, closed, filled] = await Promise.all([
      prisma.jobOpening.count({ where: base }),
      prisma.jobOpening.count({ where: { AND: [base, { status: JobOpeningStatus.draft }] } }),
      prisma.jobOpening.count({ where: { AND: [base, { status: JobOpeningStatus.open }] } }),
      prisma.jobOpening.count({ where: { AND: [base, { status: JobOpeningStatus.on_hold }] } }),
      prisma.jobOpening.count({ where: { AND: [base, { status: JobOpeningStatus.closed }] } }),
      prisma.jobOpening.count({ where: { AND: [base, { status: JobOpeningStatus.filled }] } }),
    ]);
    const counts: JobStatusCounts = { total, draft, open, on_hold, closed, filled };
    return counts;
  },

  async searchJobs(args: JobSearchArgs) {
    return prismaJobRepository.listJobs({
      scope: args.scope,
      filters: { q: args.query },
      pagination: args.pagination,
      sort: { field: "createdAt", direction: "desc" },
    });
  },

  async findByCode(code) {
    return prisma.jobOpening.findFirst({
      where: { code, deletedAt: null },
      select: { id: true },
    });
  },

  async listStages(jobId) {
    const rows = await prisma.jobOpeningStage.findMany({
      where: { jobOpeningId: jobId },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(mapStage);
  },

  async addHiringTeamMember(jobId, employeeId, role, tx) {
    const client: Client = tx ?? prisma;
    const row = await client.hiringTeamMember.create({
      data: { jobOpeningId: jobId, employeeId, role },
      select: { id: true },
    });
    return row;
  },

  async removeHiringTeamMember(memberId, tx) {
    const client: Client = tx ?? prisma;
    await client.hiringTeamMember.delete({ where: { id: memberId } });
  },

  async countHiringManagers(jobId, tx) {
    const client: Client = tx ?? prisma;
    return client.hiringTeamMember.count({
      where: { jobOpeningId: jobId, role: HiringTeamRole.hiring_manager },
    });
  },

  async listHiringTeam(jobId) {
    const rows = await prisma.hiringTeamMember.findMany({
      where: { jobOpeningId: jobId },
      include: {
        employee: {
          select: { id: true, name: true, employeeCode: true, department: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapTeamMember);
  },

  async addNote(jobId, data, tx) {
    const client: Client = tx ?? prisma;
    const row = await client.jobOpeningNote.create({
      data: {
        jobOpeningId: jobId,
        body: data.body,
        visibility: data.visibility,
        authorUserId: data.authorUserId,
      },
      select: { id: true },
    });
    return row;
  },
};

export type { NoteVisibility };
