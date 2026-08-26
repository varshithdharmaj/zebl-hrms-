import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobOpeningStatus } from "@/generated/prisma/enums";
import { createJobOpeningService } from "@/lib/recruitment/job/job-opening-service";
import { createJobOpeningSchema } from "@/lib/validation/schemas/recruitment/jobs";
import type { JobRepository, JobOpeningDetail } from "@/lib/recruitment/job/types";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/recruitment/shared/after-commit", () => ({
  createAfterCommitBuffer: () => {
    const events: unknown[] = [];
    return {
      enqueue: (e: unknown) => events.push(e),
      flush: vi.fn(async () => undefined),
      get size() {
        return events.length;
      },
    };
  },
  publishAfterCommit: vi.fn(),
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: unknown) => Promise<T>) => work({}),
}));

const { jobOpeningFindUnique, jobOpeningUpdate } = vi.hoisted(() => ({
  jobOpeningFindUnique: vi.fn(async () => ({ publicSlug: null as string | null })),
  jobOpeningUpdate: vi.fn(async () => ({})),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recruitmentSettings: {
      findUnique: vi.fn(async () => ({ defaultPipelineTemplateId: "tmpl-1" })),
    },
    recruitmentPipelineTemplate: {
      findFirst: vi.fn(async () => ({
        id: "tmpl-1",
        stages: [
          {
            stage: "resume_received",
            sortOrder: 0,
            isOptional: false,
            label: "Resume",
            slaDays: 2,
          },
        ],
      })),
    },
    employee: {
      findFirst: vi.fn(async ({ where }: { where: { id: number } }) => ({ id: where.id })),
    },
    jobOpening: {
      findUnique: jobOpeningFindUnique,
      update: jobOpeningUpdate,
    },
  },
}));

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

function baseJob(overrides: Partial<JobOpeningDetail> = {}): JobOpeningDetail {
  return {
    id: "job-1",
    title: "Engineer",
    code: "ENG-1",
    status: JobOpeningStatus.draft,
    department: "Engineering",
    location: "Remote",
    openingsCount: 1,
    employmentType: "full_time",
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    publishedAt: null,
    targetStartDate: null,
    deletedAt: null,
    ownerRecruiterUserId: "user-hr",
    ownerRecruiterEmail: "hr@example.com",
    hiringManagerName: null,
    hiringManagerEmployeeId: null,
    applicationCount: 0,
    interviewedApplicationCount: 0,
    hiredApplicationCount: 0,
    workMode: "remote",
    description: null,
    requirements: null,
    skillsText: null,
    headcountApproved: false,
    headcountRequestedByEmployeeId: null,
    headcountRequestedByName: null,
    headcountRequestedAt: null,
    headcountUrgency: null,
    compensationCurrency: null,
    compensationMin: null,
    compensationMax: null,
    pipelineTemplateId: "tmpl-1",
    pipelineTemplateName: "Default",
    createdByUserId: "user-hr",
    filledAt: null,
    isPubliclyListed: false,
    publicSlug: null,
    stages: [
      {
        id: "st-1",
        stage: "resume_received",
        sortOrder: 0,
        isOptional: false,
        isEnabled: true,
        label: "Resume",
        slaDays: 2,
      },
    ],
    hiringTeam: [],
    notes: [],
    ...overrides,
  };
}

describe("JobOpeningService", () => {
  const repo: JobRepository = {
    createJob: vi.fn(async () => ({ id: "job-new" })),
    updateJob: vi.fn(async () => undefined),
    archiveJob: vi.fn(async () => undefined),
    reopenJob: vi.fn(async () => undefined),
    closeJob: vi.fn(async () => undefined),
    changeStatus: vi.fn(async () => undefined),
    getJob: vi.fn(async () => baseJob()),
    listJobs: vi.fn(async () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    })),
    countJobs: vi.fn(async () => ({
      total: 0,
      draft: 0,
      open: 0,
      on_hold: 0,
      closed: 0,
      filled: 0,
    })),
    searchJobs: vi.fn(async () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    })),
    findByCode: vi.fn(async () => null),
    listStages: vi.fn(async () => baseJob().stages),
    addHiringTeamMember: vi.fn(async () => ({ id: "htm-1" })),
    removeHiringTeamMember: vi.fn(async () => undefined),
    countHiringManagers: vi.fn(async () => 0),
    listHiringTeam: vi.fn(async () => []),
    addNote: vi.fn(async () => ({ id: "note-1" })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(baseJob());
    (repo.findByCode as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (repo.countHiringManagers as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    jobOpeningFindUnique.mockReset();
    jobOpeningUpdate.mockReset();
    jobOpeningUpdate.mockResolvedValue({});
  });

  it("creates a job opening", async () => {
    const service = createJobOpeningService(repo);
    const result = await service.create(hrSession, createJobOpeningSchema.parse({
      title: "Backend Engineer",
      openingsCount: 1,
      employmentType: "full_time",
      headcountApproved: false,
      teamLeadEmployeeIds: [],
      publish: false,
    }));
    expect(result.jobId).toBe("job-new");
    expect(repo.createJob).toHaveBeenCalled();
  });

  it("rejects illegal status transition", async () => {
    const service = createJobOpeningService(repo);
    await expect(service.changeStatus(hrSession, "job-1", JobOpeningStatus.filled)).rejects.toBeInstanceOf(
      RecruitmentDomainError
    );
  });

  it("closes open jobs with reason", async () => {
    (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
      baseJob({ status: JobOpeningStatus.open })
    );
    const service = createJobOpeningService(repo);
    await service.close(hrSession, "job-1", "Role cancelled");
    expect(repo.changeStatus).toHaveBeenCalledWith(
      "job-1",
      JobOpeningStatus.closed,
      expect.objectContaining({ closedAt: expect.any(Date) }),
      expect.anything()
    );
  });

  it("archives without hard delete", async () => {
    const service = createJobOpeningService(repo);
    await service.archive(hrSession, "job-1");
    expect(repo.archiveJob).toHaveBeenCalledWith("job-1", expect.anything());
  });

  it("enforces single hiring manager", async () => {
    (repo.countHiringManagers as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
      baseJob({
        hiringTeam: [
          {
            id: "htm-1",
            employeeId: 9,
            role: "hiring_manager",
            employeeName: "Existing HM",
            employeeCode: "E9",
            department: null,
          },
        ],
      })
    );
    const service = createJobOpeningService(repo);
    await expect(
      service.addHiringTeamMember(hrSession, "job-1", 10, "hiring_manager")
    ).rejects.toMatchObject({ code: "REC_JOB_SINGLE_HM" });
  });

  describe("setPublicListing", () => {
    it("rejects publishing a job that is not open", async () => {
      (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
        baseJob({ status: JobOpeningStatus.draft })
      );
      const service = createJobOpeningService(repo);
      await expect(
        service.setPublicListing(hrSession, "job-1", { isPubliclyListed: true })
      ).rejects.toMatchObject({ code: "REC_JOB_ILLEGAL_STATUS" });
      expect(jobOpeningUpdate).not.toHaveBeenCalled();
    });

    it("generates a stable slug the first time an open job is published", async () => {
      (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
        baseJob({ status: JobOpeningStatus.open, title: "Senior Backend Engineer" })
      );
      jobOpeningFindUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
        if ("id" in where) return { publicSlug: null };
        return null; // no collision for the generated slug candidate
      });

      const service = createJobOpeningService(repo);
      const result = await service.setPublicListing(hrSession, "job-1", { isPubliclyListed: true });

      expect(result).toEqual({ isPubliclyListed: true, publicSlug: "senior-backend-engineer" });
      expect(jobOpeningUpdate).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: { isPubliclyListed: true, publicSlug: "senior-backend-engineer" },
      });
    });

    it("resolves a slug collision with a numeric suffix", async () => {
      (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
        baseJob({ status: JobOpeningStatus.open, title: "Backend Engineer" })
      );
      jobOpeningFindUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
        if ("id" in where) return { publicSlug: null };
        if (where.publicSlug === "backend-engineer") return { id: "some-other-job" };
        return null;
      });

      const service = createJobOpeningService(repo);
      const result = await service.setPublicListing(hrSession, "job-1", { isPubliclyListed: true });

      expect(result.publicSlug).toBe("backend-engineer-2");
    });

    it("preserves the existing slug on republish rather than generating a new one", async () => {
      (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
        baseJob({ status: JobOpeningStatus.open, title: "Backend Engineer" })
      );
      jobOpeningFindUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
        if ("id" in where) return { publicSlug: "backend-engineer" };
        return null;
      });

      const service = createJobOpeningService(repo);
      const result = await service.setPublicListing(hrSession, "job-1", { isPubliclyListed: true });

      expect(result.publicSlug).toBe("backend-engineer");
    });

    it("keeps the slug when unpublishing (does not delete it)", async () => {
      (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
        baseJob({ status: JobOpeningStatus.open, title: "Backend Engineer" })
      );
      jobOpeningFindUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
        if ("id" in where) return { publicSlug: "backend-engineer" };
        return null;
      });

      const service = createJobOpeningService(repo);
      const result = await service.setPublicListing(hrSession, "job-1", { isPubliclyListed: false });

      expect(result).toEqual({ isPubliclyListed: false, publicSlug: "backend-engineer" });
      expect(jobOpeningUpdate).toHaveBeenCalledWith({
        where: { id: "job-1" },
        data: { isPubliclyListed: false, publicSlug: "backend-engineer" },
      });
    });

    it("allows unpublishing even when the job is not open (e.g. already closed)", async () => {
      (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
        baseJob({ status: JobOpeningStatus.closed, title: "Backend Engineer" })
      );
      jobOpeningFindUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
        if ("id" in where) return { publicSlug: "backend-engineer" };
        return null;
      });

      const service = createJobOpeningService(repo);
      await expect(
        service.setPublicListing(hrSession, "job-1", { isPubliclyListed: false })
      ).resolves.toEqual({ isPubliclyListed: false, publicSlug: "backend-engineer" });
    });

    it("enforces the same RBAC as other job-management actions", async () => {
      const service = createJobOpeningService(repo);
      const employeeSession: SessionUser = { ...hrSession, id: "user-emp", role: "employee" };
      await expect(
        service.setPublicListing(employeeSession, "job-1", { isPubliclyListed: true })
      ).rejects.toThrow();
      expect(jobOpeningUpdate).not.toHaveBeenCalled();
    });

    it("rejects publishing a job that does not exist", async () => {
      (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const service = createJobOpeningService(repo);
      await expect(
        service.setPublicListing(hrSession, "missing-job", { isPubliclyListed: true })
      ).rejects.toMatchObject({ code: "REC_NOT_FOUND" });
    });
  });
});
