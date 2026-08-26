import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecruitmentPipelineStage, StageCategory } from "@/generated/prisma/enums";
import { createPipelineStageService } from "@/lib/recruitment/job/pipeline-stage-service";
import type { JobRepository, JobOpeningDetail, JobOpeningStageView } from "@/lib/recruitment/job/types";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: unknown) => Promise<T>) => work({}),
}));

vi.mock("@/lib/recruitment/services/timeline-service", () => ({
  RecruitmentTimelineService: {
    append: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_ACTIONS: {
    RECRUITMENT_JOB_STAGE_ADDED: "recruitment.job.stage_added",
    RECRUITMENT_JOB_STAGE_UPDATED: "recruitment.job.stage_updated",
    RECRUITMENT_JOB_STAGE_MOVED: "recruitment.job.stage_moved",
    RECRUITMENT_JOB_STAGE_ARCHIVED: "recruitment.job.stage_archived",
  },
  writeAuditLog: vi.fn(async () => undefined),
}));

const { applicationCount } = vi.hoisted(() => ({
  applicationCount: vi.fn(async () => 0),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    application: { count: applicationCount },
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

const employeeSession: SessionUser = { ...hrSession, id: "user-emp", role: "employee" };

function stage(overrides: Partial<JobOpeningStageView> = {}): JobOpeningStageView {
  return {
    id: "st-screening",
    jobOpeningId: "job-1",
    stage: RecruitmentPipelineStage.screening,
    category: StageCategory.SCREENING,
    sortOrder: 1,
    isOptional: false,
    isEnabled: true,
    isArchived: false,
    label: "Screening",
    slaDays: null,
    ...overrides,
  };
}

function baseJob(stages: JobOpeningStageView[]): JobOpeningDetail {
  return {
    id: "job-1",
    title: "Engineer",
    code: null,
    status: "open",
    department: null,
    location: null,
    openingsCount: 1,
    employmentType: "full_time",
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    publishedAt: null,
    targetStartDate: null,
    deletedAt: null,
    ownerRecruiterUserId: null,
    ownerRecruiterEmail: null,
    hiringManagerName: null,
    hiringManagerEmployeeId: null,
    applicationCount: 0,
    interviewedApplicationCount: 0,
    hiredApplicationCount: 0,
    workMode: null,
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
    pipelineTemplateId: null,
    pipelineTemplateName: null,
    createdByUserId: null,
    filledAt: null,
    isPubliclyListed: false,
    publicSlug: null,
    stages,
    hiringTeam: [],
    notes: [],
  } as unknown as JobOpeningDetail;
}

describe("PipelineStageService", () => {
  let repo: JobRepository;

  beforeEach(() => {
    applicationCount.mockClear().mockResolvedValue(0);
    repo = {
      createJob: vi.fn(),
      updateJob: vi.fn(),
      archiveJob: vi.fn(),
      reopenJob: vi.fn(),
      closeJob: vi.fn(),
      changeStatus: vi.fn(),
      getJob: vi.fn(async () => baseJob([stage()])),
      listJobs: vi.fn(),
      countJobs: vi.fn(),
      searchJobs: vi.fn(),
      findByCode: vi.fn(),
      listStages: vi.fn(async () => [stage()]),
      insertJobStage: vi.fn(async () => ({ id: "st-new" })),
      updateJobStage: vi.fn(async () => undefined),
      moveJobStage: vi.fn(async () => undefined),
      archiveJobStage: vi.fn(async () => undefined),
      getJobStage: vi.fn(async () => stage()),
      addHiringTeamMember: vi.fn(),
      removeHiringTeamMember: vi.fn(),
      countHiringManagers: vi.fn(),
      listHiringTeam: vi.fn(),
      addNote: vi.fn(),
    } as unknown as JobRepository;
  });

  describe("authorization", () => {
    it("blocks createStage for non-HR/admin sessions", async () => {
      const service = createPipelineStageService(repo);
      await expect(
        service.createStage(employeeSession, {
          jobOpeningId: "job-1",
          label: "Take-home Test",
          category: StageCategory.ASSESSMENT,
        })
      ).rejects.toThrow();
      expect(repo.insertJobStage).not.toHaveBeenCalled();
    });

    it("blocks archiveStage for non-HR/admin sessions", async () => {
      const service = createPipelineStageService(repo);
      await expect(
        service.archiveStage(employeeSession, { stageId: "st-screening" })
      ).rejects.toThrow();
      expect(repo.archiveJobStage).not.toHaveBeenCalled();
    });

    it("blocks moveStage for non-HR/admin sessions", async () => {
      const service = createPipelineStageService(repo);
      await expect(
        service.moveStage(employeeSession, { stageId: "st-screening", direction: "left" })
      ).rejects.toThrow();
      expect(repo.moveJobStage).not.toHaveBeenCalled();
    });

    it("blocks updateStage for non-HR/admin sessions", async () => {
      const service = createPipelineStageService(repo);
      await expect(
        service.updateStage(employeeSession, { stageId: "st-screening", label: "New name" })
      ).rejects.toThrow();
      expect(repo.updateJobStage).not.toHaveBeenCalled();
    });
  });

  describe("createStage", () => {
    it("inserts a stage picking a free enum slot", async () => {
      const service = createPipelineStageService(repo);
      const result = await service.createStage(hrSession, {
        jobOpeningId: "job-1",
        label: "Take-home Test",
        category: StageCategory.ASSESSMENT,
      });

      expect(result.id).toBe("st-new");
      expect(repo.insertJobStage).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({
          label: "Take-home Test",
          category: StageCategory.ASSESSMENT,
          stage: RecruitmentPipelineStage.assessment,
        }),
        expect.anything()
      );
    });

    it("rejects a duplicate stage name on the same job", async () => {
      (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(
        baseJob([stage({ label: "Screening" })])
      );
      const service = createPipelineStageService(repo);
      await expect(
        service.createStage(hrSession, {
          jobOpeningId: "job-1",
          label: "screening ", // same name, different case/whitespace
          category: StageCategory.SCREENING,
        })
      ).rejects.toMatchObject({ code: "REC_CONFLICT" });
      expect(repo.insertJobStage).not.toHaveBeenCalled();
    });

    it("throws when every insertable enum slot is already used", async () => {
      const allUsed = [
        RecruitmentPipelineStage.screening,
        RecruitmentPipelineStage.assessment,
        RecruitmentPipelineStage.hr_round,
        RecruitmentPipelineStage.technical_round,
        RecruitmentPipelineStage.team_lead_round,
        RecruitmentPipelineStage.manager_round,
        RecruitmentPipelineStage.client_round,
        RecruitmentPipelineStage.reference_check,
      ].map((s, i) => stage({ id: `st-${i}`, stage: s, label: `Stage ${i}` }));
      (repo.getJob as ReturnType<typeof vi.fn>).mockResolvedValue(baseJob(allUsed));

      const service = createPipelineStageService(repo);
      await expect(
        service.createStage(hrSession, {
          jobOpeningId: "job-1",
          label: "One More Stage",
          category: StageCategory.SCREENING,
        })
      ).rejects.toMatchObject({ code: "REC_PRECONDITION" });
      expect(repo.insertJobStage).not.toHaveBeenCalled();
    });
  });

  describe("system stage protection", () => {
    const systemStage = stage({
      id: "st-decision",
      stage: RecruitmentPipelineStage.decision,
      category: StageCategory.DECISION,
      label: "Decision",
    });

    it("refuses to rename a system stage", async () => {
      (repo.getJobStage as ReturnType<typeof vi.fn>).mockResolvedValue(systemStage);
      const service = createPipelineStageService(repo);
      await expect(
        service.updateStage(hrSession, { stageId: "st-decision", label: "Renamed" })
      ).rejects.toBeInstanceOf(RecruitmentDomainError);
      expect(repo.updateJobStage).not.toHaveBeenCalled();
    });

    it("refuses to archive a system stage", async () => {
      (repo.getJobStage as ReturnType<typeof vi.fn>).mockResolvedValue(systemStage);
      const service = createPipelineStageService(repo);
      await expect(
        service.archiveStage(hrSession, { stageId: "st-decision" })
      ).rejects.toBeInstanceOf(RecruitmentDomainError);
      expect(repo.archiveJobStage).not.toHaveBeenCalled();
    });

    it("refuses to move a system stage", async () => {
      (repo.getJobStage as ReturnType<typeof vi.fn>).mockResolvedValue(systemStage);
      const service = createPipelineStageService(repo);
      await expect(
        service.moveStage(hrSession, { stageId: "st-decision", direction: "left" })
      ).rejects.toBeInstanceOf(RecruitmentDomainError);
      expect(repo.moveJobStage).not.toHaveBeenCalled();
    });
  });

  describe("archiveStage", () => {
    it("archives without touching applications, and is idempotent", async () => {
      const service = createPipelineStageService(repo);
      await service.archiveStage(hrSession, { stageId: "st-screening" });

      expect(repo.archiveJobStage).toHaveBeenCalledWith("st-screening", expect.anything());

      // Idempotent: calling again on an already-archived stage no-ops.
      (repo.getJobStage as ReturnType<typeof vi.fn>).mockResolvedValue(stage({ isArchived: true }));
      (repo.archiveJobStage as ReturnType<typeof vi.fn>).mockClear();
      await service.archiveStage(hrSession, { stageId: "st-screening" });
      expect(repo.archiveJobStage).not.toHaveBeenCalled();
    });
  });
});
