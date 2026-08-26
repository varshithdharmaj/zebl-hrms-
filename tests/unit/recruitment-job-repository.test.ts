import { describe, expect, it, vi, beforeEach } from "vitest";
import { JobOpeningStatus } from "@/generated/prisma/enums";

const create = vi.fn();
const update = vi.fn();
const findFirst = vi.fn();
const findMany = vi.fn();
const count = vi.fn();
const stageFindMany = vi.fn();
const teamCreate = vi.fn();
const teamDelete = vi.fn();
const teamCount = vi.fn();
const teamFindMany = vi.fn();
const noteCreate = vi.fn();
const applicationGroupBy = vi.fn(async () => []);
const stageHistoryFindMany = vi.fn(async () => []);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOpening: {
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
    },
    jobOpeningStage: {
      findMany: (...args: unknown[]) => stageFindMany(...args),
    },
    hiringTeamMember: {
      create: (...args: unknown[]) => teamCreate(...args),
      delete: (...args: unknown[]) => teamDelete(...args),
      count: (...args: unknown[]) => teamCount(...args),
      findMany: (...args: unknown[]) => teamFindMany(...args),
    },
    jobOpeningNote: {
      create: (...args: unknown[]) => noteCreate(...args),
    },
    application: {
      groupBy: (...args: unknown[]) => applicationGroupBy(...args),
    },
    applicationStageHistory: {
      findMany: (...args: unknown[]) => stageHistoryFindMany(...args),
    },
  },
}));

import { prismaJobRepository } from "@/lib/recruitment/repositories/prisma-job-repository";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";

describe("prismaJobRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates job with stages and team", async () => {
    create.mockResolvedValue({ id: "job-1" });
    const result = await prismaJobRepository.createJob(
      {
        title: "Engineer",
        openingsCount: 1,
        employmentType: "full_time",
        status: JobOpeningStatus.draft,
      },
      [{ stage: "resume_received", sortOrder: 0 }],
      [{ employeeId: 5, role: "hiring_manager" }]
    );
    expect(result.id).toBe("job-1");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stages: expect.any(Object),
          hiringTeam: expect.any(Object),
        }),
      })
    );
  });

  it("archives by setting deletedAt", async () => {
    update.mockResolvedValue({});
    await prismaJobRepository.archiveJob("job-1");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it("lists jobs under unrestricted scope", async () => {
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([
      {
        id: "job-1",
        title: "Engineer",
        code: null,
        status: JobOpeningStatus.open,
        department: "Eng",
        location: null,
        openingsCount: 1,
        employmentType: "full_time",
        createdAt: new Date(),
        updatedAt: new Date(),
        closedAt: null,
        publishedAt: new Date(),
        targetStartDate: null,
        deletedAt: null,
        ownerRecruiterUserId: null,
        ownerRecruiter: null,
        hiringTeam: [],
        _count: { applications: 0 },
      },
    ]);
    const page = await prismaJobRepository.listJobs({
      scope: unrestrictedRecruitmentScope(),
      pagination: { page: 1, pageSize: 25 },
    });
    expect(page.total).toBe(1);
    expect(page.items[0]?.title).toBe("Engineer");
  });

  it("counts by status", async () => {
    count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    const counts = await prismaJobRepository.countJobs(unrestrictedRecruitmentScope());
    expect(counts).toEqual({
      total: 10,
      draft: 2,
      open: 4,
      on_hold: 1,
      closed: 2,
      filled: 1,
    });
  });
});
