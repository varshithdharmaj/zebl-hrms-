import { describe, expect, it, vi, beforeEach } from "vitest";
import { JobOpeningStatus } from "@/generated/prisma/enums";

const findMany = vi.fn();
const count = vi.fn();
const applicationGroupBy = vi.fn();
const stageHistoryFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOpening: {
      findMany: (...args: unknown[]) => findMany(...args),
      count: (...args: unknown[]) => count(...args),
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

function jobRow(id: string, applications: number) {
  return {
    id,
    title: `Job ${id}`,
    code: null,
    status: JobOpeningStatus.open,
    department: "Eng",
    location: null,
    openingsCount: 1,
    employmentType: "full_time",
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date(),
    closedAt: null,
    publishedAt: new Date(),
    targetStartDate: null,
    deletedAt: null,
    ownerRecruiterUserId: null,
    ownerRecruiter: null,
    hiringTeam: [],
    _count: { applications },
    isPubliclyListed: false,
    publicSlug: null,
  };
}

describe("prismaJobRepository — recruiter metrics (Applicants / Interviews / Hired)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applicationGroupBy.mockResolvedValue([]);
    stageHistoryFindMany.mockResolvedValue([]);
  });

  it("returns 0 for all metrics when a job has no applications", async () => {
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([jobRow("job-1", 0)]);

    const page = await prismaJobRepository.listJobs({
      scope: unrestrictedRecruitmentScope(),
      pagination: { page: 1, pageSize: 25 },
    });

    expect(page.items[0]).toMatchObject({
      applicationCount: 0,
      interviewedApplicationCount: 0,
      hiredApplicationCount: 0,
    });
  });

  it("counts applicants directly from the Application relation, not Candidate", async () => {
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([jobRow("job-1", 3)]);

    const page = await prismaJobRepository.listJobs({
      scope: unrestrictedRecruitmentScope(),
      pagination: { page: 1, pageSize: 25 },
    });

    expect(page.items[0]?.applicationCount).toBe(3);
    // Applicant count must exclude soft-deleted applications.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: { select: { applications: { where: { deletedAt: null } } } },
        }),
      })
    );
  });

  it("counts a candidate with multiple interview rounds once per job (distinct applications)", async () => {
    count.mockResolvedValue(2);
    findMany.mockResolvedValue([jobRow("job-1", 1), jobRow("job-2", 1)]);
    // application "app-1" reached 3 interview rounds — must still count as 1.
    stageHistoryFindMany.mockResolvedValue([
      { applicationId: "app-1", application: { jobOpeningId: "job-1" } },
    ]);

    const page = await prismaJobRepository.listJobs({
      scope: unrestrictedRecruitmentScope(),
      pagination: { page: 1, pageSize: 25 },
    });

    expect(page.items.find((j) => j.id === "job-1")?.interviewedApplicationCount).toBe(1);
    expect(page.items.find((j) => j.id === "job-2")?.interviewedApplicationCount).toBe(0);
    // distinct on applicationId is delegated to Prisma — assert we asked for it.
    expect(stageHistoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ["applicationId"] })
    );
  });

  it("attributes distinct interviewed applications to the correct job", async () => {
    count.mockResolvedValue(2);
    findMany.mockResolvedValue([jobRow("job-1", 2), jobRow("job-2", 1)]);
    stageHistoryFindMany.mockResolvedValue([
      { applicationId: "app-1", application: { jobOpeningId: "job-1" } },
      { applicationId: "app-2", application: { jobOpeningId: "job-1" } },
      { applicationId: "app-3", application: { jobOpeningId: "job-2" } },
    ]);

    const page = await prismaJobRepository.listJobs({
      scope: unrestrictedRecruitmentScope(),
      pagination: { page: 1, pageSize: 25 },
    });

    expect(page.items.find((j) => j.id === "job-1")?.interviewedApplicationCount).toBe(2);
    expect(page.items.find((j) => j.id === "job-2")?.interviewedApplicationCount).toBe(1);
  });

  it("counts one successful conversion as Hired = 1, and never double-counts", async () => {
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([jobRow("job-1", 1)]);
    applicationGroupBy.mockResolvedValue([
      { jobOpeningId: "job-1", _count: { _all: 1 } },
    ]);

    const page = await prismaJobRepository.listJobs({
      scope: unrestrictedRecruitmentScope(),
      pagination: { page: 1, pageSize: 25 },
    });

    expect(page.items[0]?.hiredApplicationCount).toBe(1);
    expect(applicationGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "hired", deletedAt: null }),
      })
    );
  });

  it("counts multiple hired applications correctly per job", async () => {
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([jobRow("job-1", 5)]);
    applicationGroupBy.mockResolvedValue([
      { jobOpeningId: "job-1", _count: { _all: 3 } },
    ]);

    const page = await prismaJobRepository.listJobs({
      scope: unrestrictedRecruitmentScope(),
      pagination: { page: 1, pageSize: 25 },
    });

    expect(page.items[0]?.hiredApplicationCount).toBe(3);
  });

  it("does not issue a per-row query for metrics (no N+1)", async () => {
    count.mockResolvedValue(3);
    findMany.mockResolvedValue([jobRow("job-1", 1), jobRow("job-2", 1), jobRow("job-3", 1)]);

    await prismaJobRepository.listJobs({
      scope: unrestrictedRecruitmentScope(),
      pagination: { page: 1, pageSize: 25 },
    });

    // Exactly one grouped query each for hired + interviewed, regardless of row count.
    expect(applicationGroupBy).toHaveBeenCalledTimes(1);
    expect(stageHistoryFindMany).toHaveBeenCalledTimes(1);
  });

  it("skips metric queries entirely when the page has no jobs", async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    const page = await prismaJobRepository.listJobs({
      scope: unrestrictedRecruitmentScope(),
      pagination: { page: 1, pageSize: 25 },
    });

    expect(page.items).toEqual([]);
    expect(applicationGroupBy).not.toHaveBeenCalled();
    expect(stageHistoryFindMany).not.toHaveBeenCalled();
  });
});
