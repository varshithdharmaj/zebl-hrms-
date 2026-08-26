import { describe, expect, it, vi, beforeEach } from "vitest";

const applicationCount = vi.fn(async () => 0);
const applicationFindMany = vi.fn(async () => []);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    application: {
      count: (...args: unknown[]) => applicationCount(...args),
      findMany: (...args: unknown[]) => applicationFindMany(...args),
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

import {
  prismaApplicationRepository,
  NEEDS_ATTENTION_STAGNANT_DAYS,
} from "@/lib/recruitment/repositories/prisma-application-repository";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";
import { ApplicationStatus, InterviewStatus, RecruitmentPipelineStage } from "@/generated/prisma/enums";

describe("prismaApplicationRepository — Needs Attention filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds a needsAttentionWhere AND condition only when the filter is true", async () => {
    await prismaApplicationRepository.listApplications({
      scope: unrestrictedRecruitmentScope(),
      filters: { needsAttention: true },
      pagination: { page: 1, pageSize: 25 },
    });

    expect(applicationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              AND: expect.arrayContaining([
                expect.objectContaining({
                  status: ApplicationStatus.active,
                  OR: expect.arrayContaining([
                    expect.objectContaining({
                      currentStage: {
                        in: [RecruitmentPipelineStage.decision, RecruitmentPipelineStage.offer],
                      },
                      decisions: { none: { isCurrent: true } },
                    }),
                    expect.objectContaining({
                      interviews: {
                        some: { status: InterviewStatus.completed, feedback: { none: {} } },
                      },
                    }),
                    expect.objectContaining({ stageEnteredAt: { lt: expect.any(Date) } }),
                  ]),
                }),
              ]),
            }),
          ]),
        }),
      })
    );
  });

  it("is a no-op when needsAttention is not set", async () => {
    await prismaApplicationRepository.listApplications({
      scope: unrestrictedRecruitmentScope(),
      filters: { status: "active" },
      pagination: { page: 1, pageSize: 25 },
    });

    const call = applicationFindMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } };
    const filtersWhereEntry = call.where.AND[1] as Record<string, unknown>;
    expect(filtersWhereEntry.AND).toBeUndefined();
  });

  it("defaults the stagnant threshold to 7 days", () => {
    expect(NEEDS_ATTENTION_STAGNANT_DAYS).toBe(7);
  });
});
