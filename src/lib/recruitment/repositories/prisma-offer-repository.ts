import { Prisma } from "@/generated/prisma/client";
import { OfferStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import {
  normalizePagination,
  paginationSkip,
  toPageResult,
} from "@/lib/recruitment/shared/pagination";
import type {
  OfferByApplication,
  OfferDetail,
  OfferDetailRow,
  OfferListFilters,
  OfferRepository,
} from "@/lib/recruitment/repositories/offer-repository";
import {
  offerDetailInclude,
  offerListInclude,
} from "@/lib/recruitment/repositories/offer-repository";

type Client = RepositoryTx;

const detailInclude = offerDetailInclude;
const listInclude = offerListInclude;

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return Number(value.toString());
}

/** Plain-object mapping so RSC → client props never carry Prisma.Decimal. */
function mapOfferRow<T extends Record<string, unknown>>(row: T): T {
  const candidate = (row as { application?: { candidate?: Record<string, unknown> } })
    .application?.candidate;

  const mappedCandidate = candidate
    ? {
        ...candidate,
        currentCtc: decimalToNumber(candidate.currentCtc as Prisma.Decimal | null),
        expectedCtc: decimalToNumber(candidate.expectedCtc as Prisma.Decimal | null),
      }
    : candidate;

  const application = (row as unknown as { application?: Record<string, unknown> }).application
    ? {
        ...(row as unknown as { application: Record<string, unknown> }).application,
        candidate: mappedCandidate,
        jobOpening: (() => {
          const job = (row as unknown as { application?: { jobOpening?: Record<string, unknown> } })
            .application?.jobOpening;
          if (!job) return job;
          return {
            ...job,
            compensationMin: decimalToNumber(job.compensationMin as Prisma.Decimal | null),
            compensationMax: decimalToNumber(job.compensationMax as Prisma.Decimal | null),
          };
        })(),
      }
    : (row as unknown as { application?: unknown }).application;

  return {
    ...row,
    baseSalary: decimalToNumber(row.baseSalary as Prisma.Decimal) ?? 0,
    variablePay: decimalToNumber(row.variablePay as Prisma.Decimal | null),
    ctc: decimalToNumber(row.ctc as Prisma.Decimal | null),
    bonus: decimalToNumber(row.bonus as Prisma.Decimal | null),
    application,
  };
}

function scopeWhere(scope: RecruitmentScope): Prisma.OfferWhereInput {
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

function filtersWhere(filters?: OfferListFilters): Prisma.OfferWhereInput {
  const where: Prisma.OfferWhereInput = {};
  if (filters?.status && filters.status !== "all") {
    if (filters.status === "expired") {
      where.OR = [
        {
          status: OfferStatus.released,
          expiresAt: { lt: new Date() },
        },
        {
          status: OfferStatus.declined,
          offerNotes: { contains: "Offer Expired" },
        },
      ];
    } else {
      where.status = filters.status as OfferStatus;
    }
  }
  if (filters?.department && filters.department !== "all") {
    where.department = filters.department;
  }
  if (filters?.jobOpeningId && filters.jobOpeningId !== "all") {
    where.application = { jobOpeningId: filters.jobOpeningId };
  }
  if (filters?.applicationId) {
    where.applicationId = filters.applicationId;
  }
  if (filters?.recruiterUserId && filters.recruiterUserId !== "all") {
    where.createdByUserId = filters.recruiterUserId;
  }
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          {
            application: {
              candidate: {
                fullName: { contains: q, mode: "insensitive" },
              },
            },
          },
          {
            offerNumber: { contains: q, mode: "insensitive" },
          },
        ],
      },
    ];
  }
  return where;
}

function mergeWhere(
  scope: RecruitmentScope,
  filters?: OfferListFilters | Record<string, string | number | boolean | undefined>
): Prisma.OfferWhereInput {
  return {
    AND: [scopeWhere(scope), filtersWhere(filters as OfferListFilters | undefined)],
  };
}

function toOfferDetail(row: OfferDetailRow): OfferDetail {
  return mapOfferRow(row as unknown as Record<string, unknown>) as OfferDetail;
}

function toOfferByApplication(row: OfferDetailRow): OfferByApplication {
  const mapped = toOfferDetail(row);
  return {
    id: mapped.id,
    status: mapped.status,
    offerNumber: mapped.offerNumber,
    ctc: mapped.ctc,
    currency: mapped.currency,
    joiningDate: mapped.joiningDate,
  };
}

export const prismaOfferRepository: OfferRepository = {
  async createOffer(data, tx) {
    const client: Client = tx ?? prisma;
    const created = await client.offer.create({
      data: {
        applicationId: data.applicationId,
        hiringDecisionId: data.hiringDecisionId ?? null,
        status: data.status ?? OfferStatus.draft,
        currency: data.currency ?? "INR",
        baseSalary: new Prisma.Decimal(data.baseSalary),
        variablePay: data.variablePay != null ? new Prisma.Decimal(data.variablePay) : null,
        benefitsNotes: data.benefitsNotes ?? null,
        proposedStartDate: data.proposedStartDate ? new Date(data.proposedStartDate) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdByUserId: data.createdByUserId ?? null,

        // Additional fields
        offerNumber: data.offerNumber ?? null,
        employmentType: data.employmentType ?? null,
        department: data.department ?? null,
        location: data.location ?? null,
        grade: data.grade ?? null,
        reportingManagerId: data.reportingManagerId ?? null,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
        ctc: data.ctc != null ? new Prisma.Decimal(data.ctc) : null,
        salaryBreakdownJson: data.salaryBreakdownJson ?? {},
        bonus: data.bonus != null ? new Prisma.Decimal(data.bonus) : null,
        stock: data.stock ?? null,
        probationDays: data.probationDays ?? null,
        noticeBuyout: data.noticeBuyout ?? false,
        offerPdfKey: data.offerPdfKey ?? null,
        offerNotes: data.offerNotes ?? null,
      },
    });

    return { id: created.id };
  },

  async updateOffer(id, patch, tx) {
    const client: Client = tx ?? prisma;
    await client.offer.update({
      where: { id },
      data: {
        status: patch.status,
        currency: patch.currency,
        baseSalary: patch.baseSalary != null ? new Prisma.Decimal(patch.baseSalary) : undefined,
        variablePay: patch.variablePay !== undefined ? (patch.variablePay != null ? new Prisma.Decimal(patch.variablePay) : null) : undefined,
        benefitsNotes: patch.benefitsNotes,
        proposedStartDate: patch.proposedStartDate ? new Date(patch.proposedStartDate) : undefined,
        expiresAt: patch.expiresAt ? new Date(patch.expiresAt) : undefined,

        // Additional fields
        offerNumber: patch.offerNumber,
        employmentType: patch.employmentType,
        department: patch.department,
        location: patch.location,
        grade: patch.grade,
        reportingManagerId: patch.reportingManagerId,
        joiningDate: patch.joiningDate ? new Date(patch.joiningDate) : undefined,
        ctc: patch.ctc != null ? new Prisma.Decimal(patch.ctc) : undefined,
        salaryBreakdownJson: patch.salaryBreakdownJson,
        bonus: patch.bonus !== undefined ? (patch.bonus != null ? new Prisma.Decimal(patch.bonus) : null) : undefined,
        stock: patch.stock,
        probationDays: patch.probationDays,
        noticeBuyout: patch.noticeBuyout,
        offerPdfKey: patch.offerPdfKey,
        offerNotes: patch.offerNotes,
      },
    });
  },

  async getOffer(id) {
    const row = await prisma.offer.findUnique({
      where: { id },
      include: detailInclude,
    });
    return row ? toOfferDetail(row) : null;
  },

  async listOffers(args) {
    const pagination = normalizePagination(args.pagination);
    const where = mergeWhere(args.scope, args.filters);

    const sortField = args.sort?.field ?? "createdAt";
    const sortDirection = args.sort?.direction ?? "desc";

    const [total, rows] = await prisma.$transaction([
      prisma.offer.count({ where }),
      prisma.offer.findMany({
        where,
        include: listInclude,
        skip: paginationSkip(pagination),
        take: pagination.pageSize,
        orderBy: { [sortField]: sortDirection },
      }),
    ]);

    return toPageResult(
      rows.map((row) => toOfferDetail({ ...row, revisions: [] } as OfferDetailRow)),
      total,
      pagination
    );
  },

  async listByApplication(applicationId) {
    const rows = await prisma.offer.findMany({
      where: { applicationId },
      include: detailInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => toOfferByApplication(row));
  },

  async sendOffer(id, expiresAt, tx) {
    const client: Client = tx ?? prisma;
    await client.offer.update({
      where: { id },
      data: {
        status: OfferStatus.released,
        releasedAt: new Date(),
        sentAt: new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    });
  },

  async acceptOffer(id, acceptedAt, tx) {
    const client: Client = tx ?? prisma;
    await client.offer.update({
      where: { id },
      data: {
        status: OfferStatus.accepted,
        acceptedAt: acceptedAt ? new Date(acceptedAt) : new Date(),
      },
    });
  },

  async declineOffer(id, declinedAt, reason, tx) {
    const client: Client = tx ?? prisma;
    await client.offer.update({
      where: { id },
      data: {
        status: OfferStatus.declined,
        declinedAt: declinedAt ? new Date(declinedAt) : new Date(),
        offerNotes: reason ? `Declined Reason: ${reason}` : undefined,
      },
    });
  },

  async withdrawOffer(id, reason, tx) {
    const client: Client = tx ?? prisma;
    await client.offer.update({
      where: { id },
      data: {
        status: OfferStatus.withdrawn,
        withdrawnAt: new Date(),
        offerNotes: reason ? `Withdrawn Reason: ${reason}` : undefined,
      },
    });
  },

  async expireOffer(id, tx) {
    const client: Client = tx ?? prisma;
    await client.offer.update({
      where: { id },
      data: {
        status: OfferStatus.declined,
        declinedAt: new Date(),
        offerNotes: "Offer Expired",
      },
    });
  },

  async createRevision(offerId, snapshot, changeNote, actorUserId, tx) {
    const client: Client = tx ?? prisma;
    
    // Find latest version
    const latest = await client.offerRevision.findFirst({
      where: { offerId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const created = await client.offerRevision.create({
      data: {
        offerId,
        version: nextVersion,
        snapshotJson: snapshot,
        changeNote,
        actorUserId,
      },
    });

    return { id: created.id };
  },

  async latestRevision(offerId) {
    return prisma.offerRevision.findFirst({
      where: { offerId },
      orderBy: { version: "desc" },
    });
  },

  async existsActiveOffer(applicationId) {
    const activeCount = await prisma.offer.count({
      where: {
        applicationId,
        status: {
          in: [
            OfferStatus.draft,
            OfferStatus.manager_approval,
            OfferStatus.hr_approval,
            OfferStatus.released,
          ],
        },
      },
    });
    return activeCount > 0;
  },
};
