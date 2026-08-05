import { Prisma } from "@/generated/prisma/client";
import {
  RecruitmentCommunicationStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import {
  normalizePagination,
  paginationSkip,
  toPageResult,
} from "@/lib/recruitment/shared/pagination";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";
import type {
  CommunicationListFilters,
  CommunicationRecord,
  CommunicationRepository,
} from "@/lib/recruitment/repositories/communication-repository";

type Client = RepositoryTx;

const detailInclude = {
  candidate: {
    select: { id: true, fullName: true, email: true },
  },
  application: {
    select: { id: true, jobOpeningId: true, candidateId: true },
  },
  jobOpening: {
    select: { id: true, title: true },
  },
  sender: {
    select: { id: true, email: true },
  },
  template: {
    select: { id: true, name: true, type: true },
  },
  attachments: {
    orderBy: { uploadedAt: "desc" as const },
  },
} as const;

function scopeWhere(scope: RecruitmentScope): Prisma.RecruitmentCommunicationWhereInput {
  if (scope.mode === "unrestricted") return {};
  return {
    OR: [
      { candidateId: { in: [...scope.candidateIds] } },
      { applicationId: { in: [...scope.applicationIds] } },
      { jobOpeningId: { in: [...scope.jobOpeningIds] } },
    ],
  };
}

function filtersWhere(
  filters?: CommunicationListFilters
): Prisma.RecruitmentCommunicationWhereInput {
  const where: Prisma.RecruitmentCommunicationWhereInput = {};

  if (!filters?.includeDeleted) {
    where.deletedAt = null;
  }
  if (filters?.candidateId) where.candidateId = filters.candidateId;
  if (filters?.applicationId) where.applicationId = filters.applicationId;
  if (filters?.jobOpeningId) where.jobOpeningId = filters.jobOpeningId;
  if (filters?.interviewId) where.interviewId = filters.interviewId;
  if (filters?.offerId) where.offerId = filters.offerId;
  if (filters?.type) where.type = filters.type;
  if (filters?.status) where.status = filters.status;
  if (filters?.senderUserId) where.senderUserId = filters.senderUserId;
  if (filters?.threadId) where.threadId = filters.threadId;

  const q = filters?.search?.trim();
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
      { recipientEmail: { contains: q, mode: "insensitive" } },
      {
        candidate: {
          fullName: { contains: q, mode: "insensitive" },
        },
      },
      {
        jobOpening: {
          title: { contains: q, mode: "insensitive" },
        },
      },
      {
        sender: {
          email: { contains: q, mode: "insensitive" },
        },
      },
    ];
  }

  return where;
}

function mergeWhere(
  scope: RecruitmentScope,
  filters?: CommunicationListFilters
): Prisma.RecruitmentCommunicationWhereInput {
  return {
    AND: [scopeWhere(scope), filtersWhere(filters)],
  };
}

function toRecord(row: unknown): CommunicationRecord {
  return row as CommunicationRecord;
}

export const prismaCommunicationRepository: CommunicationRepository = {
  async createCommunication(input, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.recruitmentCommunication.create({
      data: {
        type: input.type,
        status: input.status ?? RecruitmentCommunicationStatus.draft,
        subject: input.subject ?? null,
        body: input.body ?? null,
        candidateId: input.candidateId ?? null,
        applicationId: input.applicationId ?? null,
        jobOpeningId: input.jobOpeningId ?? null,
        interviewId: input.interviewId ?? null,
        offerId: input.offerId ?? null,
        templateId: input.templateId ?? null,
        senderUserId: input.senderUserId ?? null,
        recipientEmail: input.recipientEmail ?? null,
        threadId: input.threadId ?? null,
        parentId: input.parentId ?? null,
        scheduledFor: input.scheduledFor ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { id: created.id };
  },

  async updateCommunication(id, input, tx) {
    const client: Client = tx ?? prisma;
    const data: Prisma.RecruitmentCommunicationUpdateInput = {};

    if (input.status !== undefined) data.status = input.status;
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.body !== undefined) data.body = input.body;
    if (input.recipientEmail !== undefined) data.recipientEmail = input.recipientEmail;
    if (input.sentAt !== undefined) data.sentAt = input.sentAt;
    if (input.deliveredAt !== undefined) data.deliveredAt = input.deliveredAt;
    if (input.scheduledFor !== undefined) data.scheduledFor = input.scheduledFor;
    if (input.errorMessage !== undefined) data.errorMessage = input.errorMessage;
    if (input.threadId !== undefined) data.threadId = input.threadId;
    if (input.metadata !== undefined) {
      data.metadata = input.metadata as Prisma.InputJsonValue;
    }
    if (input.templateId !== undefined) {
      data.template = input.templateId
        ? { connect: { id: input.templateId } }
        : { disconnect: true };
    }
    if (input.candidateId !== undefined) {
      data.candidate = input.candidateId
        ? { connect: { id: input.candidateId } }
        : { disconnect: true };
    }
    if (input.applicationId !== undefined) {
      data.application = input.applicationId
        ? { connect: { id: input.applicationId } }
        : { disconnect: true };
    }
    if (input.jobOpeningId !== undefined) {
      data.jobOpening = input.jobOpeningId
        ? { connect: { id: input.jobOpeningId } }
        : { disconnect: true };
    }
    if (input.interviewId !== undefined) {
      data.interview = input.interviewId
        ? { connect: { id: input.interviewId } }
        : { disconnect: true };
    }
    if (input.offerId !== undefined) {
      data.offer = input.offerId
        ? { connect: { id: input.offerId } }
        : { disconnect: true };
    }

    await client.recruitmentCommunication.update({
      where: { id },
      data,
    });
  },

  async getCommunication(id) {
    const row = await prisma.recruitmentCommunication.findFirst({
      where: { id, deletedAt: null },
      include: detailInclude,
    });
    return row ? toRecord(row) : null;
  },

  async listCommunications(args) {
    const pagination = normalizePagination(args.pagination);
    const where = mergeWhere(args.scope, args.filters);

    const [items, total] = await Promise.all([
      prisma.recruitmentCommunication.findMany({
        where,
        include: detailInclude,
        orderBy: { createdAt: "desc" },
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
      }),
      prisma.recruitmentCommunication.count({ where }),
    ]);

    return toPageResult(items.map(toRecord), total, pagination);
  },

  async searchCommunications(args) {
    return prismaCommunicationRepository.listCommunications({
      scope: args.scope,
      filters: {
        ...args.filters,
        search: args.query,
      },
      pagination: args.pagination,
    });
  },

  async getCommunicationThread(threadId, scope) {
    const where = mergeWhere(scope, { threadId, includeDeleted: false });
    const rows = await prisma.recruitmentCommunication.findMany({
      where,
      include: detailInclude,
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  },

  async softDeleteCommunication(id, tx) {
    const client: Client = tx ?? prisma;
    await client.recruitmentCommunication.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async createTemplate(input, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.recruitmentEmailTemplate.create({
      data: {
        name: input.name,
        type: input.type,
        subject: input.subject,
        body: input.body,
        isSystem: input.isSystem ?? false,
        isActive: input.isActive ?? true,
        createdByUserId: input.createdByUserId ?? null,
      },
      select: { id: true },
    });
    return { id: created.id };
  },

  async updateTemplate(id, input, tx) {
    const client: Client = tx ?? prisma;
    await client.recruitmentEmailTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  },

  async getTemplate(id) {
    return prisma.recruitmentEmailTemplate.findFirst({
      where: { id, deletedAt: null },
    });
  },

  async listTemplates(filters) {
    const search = filters?.search?.trim();
    return prisma.recruitmentEmailTemplate.findMany({
      where: {
        deletedAt: null,
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
        ...(filters?.isSystem !== undefined ? { isSystem: filters.isSystem } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { subject: { contains: search, mode: "insensitive" } },
                { body: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  },

  async softDeleteTemplate(id, tx) {
    const client: Client = tx ?? prisma;
    await client.recruitmentEmailTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  },

  async restoreTemplate(id, tx) {
    const client: Client = tx ?? prisma;
    await client.recruitmentEmailTemplate.update({
      where: { id },
      data: { deletedAt: null, isActive: true },
    });
  },

  async addAttachment(communicationId, attachment, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.recruitmentCommunicationAttachment.create({
      data: {
        communicationId,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        storagePath: attachment.storagePath,
      },
      select: { id: true },
    });
    return { id: created.id };
  },

  async getAttachment(id) {
    return prisma.recruitmentCommunicationAttachment.findUnique({
      where: { id },
      select: {
        id: true,
        communicationId: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        storagePath: true,
        uploadedAt: true,
      },
    });
  },

  async getAttachments(communicationId) {
    return prisma.recruitmentCommunicationAttachment.findMany({
      where: { communicationId },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        storagePath: true,
        uploadedAt: true,
      },
    });
  },

  async deleteAttachment(id, tx) {
    const client: Client = tx ?? prisma;
    await client.recruitmentCommunicationAttachment.delete({
      where: { id },
    });
  },

  async countByStatus(status, scope, senderUserId) {
    return prisma.recruitmentCommunication.count({
      where: mergeWhere(scope, {
        status,
        senderUserId,
        includeDeleted: false,
      }),
    });
  },

  async countDraftsByUser(userId, scope) {
    return prismaCommunicationRepository.countByStatus(
      RecruitmentCommunicationStatus.draft,
      scope,
      userId
    );
  },
};
