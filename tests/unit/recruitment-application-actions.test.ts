import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApplicationPriority,
  ApplicationStatus,
  RecruitmentPipelineStage,
} from "@/generated/prisma/enums";
import {
  createApplicationAction,
  updateApplicationAction,
  moveApplicationStageAction,
  rejectApplicationAction,
  withdrawApplicationAction,
  reopenApplicationAction,
  hireCandidateAction,
  archiveApplicationAction,
  restoreApplicationAction,
} from "@/actions/recruitment-applications";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireHROrSuperAdminSession: async () => ({
    id: "user-hr",
    email: "hr@example.com",
    role: "hr",
    employeeId: 1,
    employeeName: "HR User",
    sessionVersion: 1,
    authProvider: "local",
    userId: "user-hr",
  }),
}));

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

const mockCreateApplication = vi.fn(async () => ({ id: "app-1" }));
const mockUpdateApplication = vi.fn(async () => undefined);
const mockMoveToStage = vi.fn(async () => undefined);
const mockRejectApplication = vi.fn(async () => undefined);
const mockWithdrawApplication = vi.fn(async () => undefined);
const mockReopenApplication = vi.fn(async () => undefined);
const mockHireCandidate = vi.fn(async () => undefined);
const mockArchiveApplication = vi.fn(async () => undefined);
const mockRestoreApplication = vi.fn(async () => undefined);

vi.mock("@/lib/recruitment/services/application-service", () => ({
  createApplicationService: () => ({
    createApplication: (...args: any[]) => (mockCreateApplication as any)(...args),
    updateApplication: (...args: any[]) => (mockUpdateApplication as any)(...args),
    moveToStage: (...args: any[]) => (mockMoveToStage as any)(...args),
    rejectApplication: (...args: any[]) => (mockRejectApplication as any)(...args),
    withdrawApplication: (...args: any[]) => (mockWithdrawApplication as any)(...args),
    reopenApplication: (...args: any[]) => (mockReopenApplication as any)(...args),
    hireCandidate: (...args: any[]) => (mockHireCandidate as any)(...args),
    archiveApplication: (...args: any[]) => (mockArchiveApplication as any)(...args),
    restoreApplication: (...args: any[]) => (mockRestoreApplication as any)(...args),
  }),
}));

describe("Application Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create application via action", async () => {
    const res = await createApplicationAction(
      {},
      {
        candidateId: "cand-1",
        jobOpeningId: "job-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(res.applicationId).toBe("app-1");
    expect(mockCreateApplication).toHaveBeenCalled();
  });

  it("should update application via action", async () => {
    const res = await updateApplicationAction(
      {},
      {
        id: "app-1",
        priority: ApplicationPriority.high,
      }
    );

    expect(res.success).toBeDefined();
    expect(mockUpdateApplication).toHaveBeenCalled();
  });

  it("should move application stage via action", async () => {
    const res = await moveApplicationStageAction(
      {},
      {
        id: "app-1",
        stage: RecruitmentPipelineStage.screening,
      }
    );

    expect(res.success).toBeDefined();
    expect(mockMoveToStage).toHaveBeenCalled();
  });

  it("should reject application via action", async () => {
    const res = await rejectApplicationAction(
      {},
      {
        id: "app-1",
        reason: "Failed assessment",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockRejectApplication).toHaveBeenCalled();
  });

  it("should withdraw application via action", async () => {
    const res = await withdrawApplicationAction(
      {},
      {
        id: "app-1",
        reason: "Took another offer",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockWithdrawApplication).toHaveBeenCalled();
  });

  it("should reopen application via action", async () => {
    const res = await reopenApplicationAction(
      {},
      {
        id: "app-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockReopenApplication).toHaveBeenCalled();
  });

  it("should hire candidate via action", async () => {
    const res = await hireCandidateAction(
      {},
      {
        id: "app-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockHireCandidate).toHaveBeenCalled();
  });

  it("should archive application via action", async () => {
    const res = await archiveApplicationAction(
      {},
      {
        id: "app-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockArchiveApplication).toHaveBeenCalled();
  });

  it("should restore application via action", async () => {
    const res = await restoreApplicationAction(
      {},
      {
        id: "app-1",
      }
    );

    expect(res.success).toBeDefined();
    expect(mockRestoreApplication).toHaveBeenCalled();
  });
});
