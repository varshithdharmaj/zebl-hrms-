import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApplicationPriority,
  ApplicationStatus,
  RecruitmentPipelineStage,
} from "@/generated/prisma/enums";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import type { ApplicationRepository } from "@/lib/recruitment/repositories/application-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    applicationStageHistory: {
      findMany: vi.fn(async () => []),
    },
  },
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
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: any) => Promise<T>) => {
    const mockTx = {
      applicationStageHistory: {
        create: vi.fn(async () => ({})),
      },
      candidate: {
        update: vi.fn(async () => ({})),
      },
    };
    return work(mockTx);
  },
}));

vi.mock("@/lib/recruitment/services/timeline-service", () => ({
  RecruitmentTimelineService: {
    append: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/recruitment/events/publisher", () => ({
  publishRecruitmentEvent: vi.fn(async () => undefined),
}));

vi.mock("@/lib/recruitment/repositories/prisma-job-repository", () => ({
  prismaJobRepository: {
    getJob: vi.fn(async () => ({
      id: "job-1",
      title: "Frontend Engineer",
      stages: [
        { stage: RecruitmentPipelineStage.resume_received, sortOrder: 1 },
        { stage: RecruitmentPipelineStage.screening, sortOrder: 2 },
        { stage: RecruitmentPipelineStage.hr_round, sortOrder: 3 },
      ],
    })),
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

describe("ApplicationService", () => {
  let mockRepo: ApplicationRepository;

  beforeEach(() => {
    mockRepo = {
      createApplication: vi.fn(async () => ({ id: "app-1" })),
      updateApplication: vi.fn(async () => undefined),
      archiveApplication: vi.fn(async () => undefined),
      restoreApplication: vi.fn(async () => undefined),
      getApplication: vi.fn(async () => ({
        id: "app-1",
        candidateId: "cand-1",
        jobOpeningId: "job-1",
        status: ApplicationStatus.active,
        currentStage: RecruitmentPipelineStage.resume_received,
      })),
      findByCandidate: vi.fn(async () => []),
      findByJob: vi.fn(async () => []),
      findActiveByCandidateAndJob: vi.fn(async () => null),
      listApplications: vi.fn(async () => ({ rows: [], total: 0, page: 1, pageSize: 10, totalPages: 0 })),
      searchApplications: vi.fn(async () => ({ rows: [], total: 0, page: 1, pageSize: 10, totalPages: 0 })),
      assignRecruiter: vi.fn(async () => undefined),
      assignManager: vi.fn(async () => undefined),
      setPriority: vi.fn(async () => undefined),
      setStatus: vi.fn(async () => undefined),
      setAggregateScore: vi.fn(async () => undefined),
      moveApplicationStage: vi.fn(async () => undefined),
      countApplications: vi.fn(async () => ({})),
    } as unknown as ApplicationRepository;
  });

  it("should create application successfully and assign first stage", async () => {
    const service = createApplicationService(mockRepo);
    const result = await service.createApplication(hrSession, {
      candidateId: "cand-1",
      jobOpeningId: "job-1",
    });

    expect(result.id).toBe("app-1");
    expect(mockRepo.createApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: "cand-1",
        jobOpeningId: "job-1",
        currentStage: RecruitmentPipelineStage.resume_received,
        status: ApplicationStatus.active,
      }),
      expect.anything()
    );
  });

  it("should throw conflict error if candidate already has active application for the job", async () => {
    mockRepo.findActiveByCandidateAndJob = vi.fn(async () => ({ id: "app-existing" }));
    const service = createApplicationService(mockRepo);

    await expect(
      service.createApplication(hrSession, {
        candidateId: "cand-1",
        jobOpeningId: "job-1",
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });

  it("should move stage successfully", async () => {
    const service = createApplicationService(mockRepo);
    await service.moveToStage(hrSession, {
      id: "app-1",
      stage: RecruitmentPipelineStage.screening,
    });

    expect(mockRepo.moveApplicationStage).toHaveBeenCalledWith(
      "app-1",
      RecruitmentPipelineStage.screening,
      expect.any(Date),
      undefined,
      expect.anything()
    );
  });

  it("should reject application successfully", async () => {
    const service = createApplicationService(mockRepo);
    await service.rejectApplication(hrSession, {
      id: "app-1",
      reason: "Failed assessment",
    });

    expect(mockRepo.updateApplication).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({
        status: ApplicationStatus.rejected,
        currentStage: RecruitmentPipelineStage.rejected,
        rejectedReason: "Failed assessment",
      }),
      expect.anything()
    );
  });

  it("should withdraw application successfully", async () => {
    const service = createApplicationService(mockRepo);
    await service.withdrawApplication(hrSession, {
      id: "app-1",
      reason: "Took another offer",
    });

    expect(mockRepo.updateApplication).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({
        status: ApplicationStatus.withdrawn,
        currentStage: RecruitmentPipelineStage.withdrawn,
        withdrawnReason: "Took another offer",
      }),
      expect.anything()
    );
  });

  it("should reopen application successfully", async () => {
    mockRepo.getApplication = vi.fn(async () => ({
      id: "app-1",
      candidateId: "cand-1",
      jobOpeningId: "job-1",
      status: ApplicationStatus.rejected,
      currentStage: RecruitmentPipelineStage.rejected,
    }));

    const service = createApplicationService(mockRepo);
    await service.reopenApplication(hrSession, "app-1");

    expect(mockRepo.updateApplication).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({
        status: ApplicationStatus.active,
        currentStage: RecruitmentPipelineStage.resume_received,
      }),
      expect.anything()
    );
  });

  it("should reject manual hire — conversion owns hired state", async () => {
    const service = createApplicationService(mockRepo);
    await expect(service.hireCandidate(hrSession, "app-1")).rejects.toThrow(
      RecruitmentDomainError
    );
    expect(mockRepo.updateApplication).not.toHaveBeenCalled();
  });

  it("should reject moving to hired stage without conversion", async () => {
    const service = createApplicationService(mockRepo);
    await expect(
      service.moveToStage(hrSession, {
        id: "app-1",
        stage: RecruitmentPipelineStage.hired,
      })
    ).rejects.toThrow(RecruitmentDomainError);
    expect(mockRepo.moveApplicationStage).not.toHaveBeenCalled();
  });
});
