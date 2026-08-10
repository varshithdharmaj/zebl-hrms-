import { Prisma } from "@/generated/prisma/client";
import type { HiringDecision, HiringDecisionOutcome } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";
import type {
  AppendHiringDecisionData,
  DecisionRepository,
  HiringDecisionRecord,
} from "@/lib/recruitment/repositories/decision-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

type Client = RepositoryTx;

const decidedBySelect = {
  decidedBy: { select: { id: true, email: true } },
} as const;

type DecisionRow = HiringDecision & {
  decidedBy?: { id: string; email: string } | null;
};

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

function mapDecisionRow(row: DecisionRow): HiringDecisionRecord {
  return {
    id: row.id,
    applicationId: row.applicationId,
    outcome: row.outcome,
    rationale: row.rationale,
    strengths: row.strengths,
    concerns: row.concerns,
    salaryRecommendation: decimalToNumber(row.salaryRecommendation),
    currency: row.currency,
    version: row.version,
    isCurrent: row.isCurrent,
    decidedByUserId: row.decidedByUserId,
    decidedByEmail: row.decidedBy?.email ?? null,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export const prismaDecisionRepository: DecisionRepository = {
  async findCurrent(applicationId) {
    const row = await prisma.hiringDecision.findFirst({
      where: { applicationId, isCurrent: true },
      include: decidedBySelect,
    });
    return row ? mapDecisionRow(row) : null;
  },

  async listByApplication(applicationId) {
    const rows = await prisma.hiringDecision.findMany({
      where: { applicationId },
      include: decidedBySelect,
      orderBy: { version: "desc" },
    });
    return rows.map((row) => mapDecisionRow(row));
  },

  async appendDecision(data: AppendHiringDecisionData, tx?: RepositoryTx) {
    const client: Client = tx ?? prisma;

    const locked = await client.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM recruitment_applications WHERE id = ${data.applicationId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
    }

    await client.hiringDecision.updateMany({
      where: { applicationId: data.applicationId, isCurrent: true },
      data: { isCurrent: false },
    });

    const aggregate = await client.hiringDecision.aggregate({
      where: { applicationId: data.applicationId },
      _max: { version: true },
    });
    const nextVersion = (aggregate._max.version ?? 0) + 1;

    try {
      const created = await client.hiringDecision.create({
        data: {
          applicationId: data.applicationId,
          outcome: data.outcome as HiringDecisionOutcome,
          rationale: data.rationale,
          strengths: data.strengths,
          concerns: data.concerns ?? null,
          salaryRecommendation:
            data.salaryRecommendation != null
              ? new Prisma.Decimal(data.salaryRecommendation)
              : null,
          currency: data.currency ?? null,
          riskTagsJson: [],
          version: nextVersion,
          isCurrent: true,
          decidedByUserId: data.decidedByUserId,
        },
        include: decidedBySelect,
      });
      return mapDecisionRow(created);
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new RecruitmentDomainError(
          "REC_CONFLICT",
          "Another hiring decision was submitted. Refresh and retry."
        );
      }
      throw error;
    }
  },
};
