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
});
