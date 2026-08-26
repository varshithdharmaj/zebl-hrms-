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

import { prismaApplicationRepository } from "@/lib/recruitment/repositories/prisma-application-repository";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";
import { INTERVIEW_STAGES } from "@/lib/recruitment/shared/pipeline-stage-groups";

describe("prismaApplicationRepository — 'interviewing' stage filter (job list → pipeline link)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("translates the 'interviewing' sentinel into an IN filter over all interview stages", async () => {
    await prismaApplicationRepository.listApplications({
      scope: unrestrictedRecruitmentScope(),
      filters: { currentStage: "interviewing" },
      pagination: { page: 1, pageSize: 25 },
    });

    expect(applicationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ currentStage: { in: [...INTERVIEW_STAGES] } }),
          ]),
        }),
      })
    );
  });

  it("still supports an exact single-stage filter", async () => {
    await prismaApplicationRepository.listApplications({
      scope: unrestrictedRecruitmentScope(),
      filters: { currentStage: "technical_round" },
      pagination: { page: 1, pageSize: 25 },
    });

    expect(applicationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ currentStage: "technical_round" }),
          ]),
        }),
      })
    );
  });
});
