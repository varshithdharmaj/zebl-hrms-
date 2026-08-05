import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import type { ApplicationRepository } from "@/lib/recruitment/repositories/application-repository";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { PermissionError } from "@/lib/permissions";
import { RecruitmentTimelineService } from "@/lib/recruitment/services/timeline-service";
import { writeAuditLog } from "@/lib/audit";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";

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
    RECRUITMENT_APPLICATION_ASSESSMENT_UPDATED: "recruitment.application.assessment_updated",
  },
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/recruitment/events/publisher", () => ({
  publishRecruitmentEvent: vi.fn(async () => undefined),
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

const employeeSession: SessionUser = {
  ...hrSession,
  id: "user-emp",
  email: "emp@example.com",
  role: "employee",
  employeeId: 2,
};

const baseApp = {
  id: "app-1",
  candidateId: "cand-1",
  jobOpeningId: "job-1",
  deletedAt: null,
  assessment: null,
};

describe("ApplicationService.updateApplicationAssessment", () => {
  let mockRepo: ApplicationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      getApplication: vi.fn(async () => ({ ...baseApp })),
      updateAssessment: vi.fn(async (_id, data) => ({
        ...baseApp,
        assessment: data.assessment,
        assessmentUpdatedAt: data.assessmentUpdatedAt,
        assessmentUpdatedByUserId: data.assessmentUpdatedByUserId,
      })),
    } as unknown as ApplicationRepository;

    vi.spyOn(RecruitmentScopeEngine, "canManageApplication").mockResolvedValue(true);
  });

  it("successfully updates assessment with timeline and audit (no body logged)", async () => {
    const service = createApplicationService(mockRepo);
    const result = await service.updateApplicationAssessment(hrSession, {
      applicationId: "app-1",
      assessment: "  Strong fit for backend role  ",
    });

    expect(result.assessment).toBe("Strong fit for backend role");
    expect(mockRepo.updateAssessment).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({
        assessment: "Strong fit for backend role",
        assessmentUpdatedByUserId: "user-hr",
      }),
      expect.anything()
    );

    const timelineArg = vi.mocked(RecruitmentTimelineService.append).mock.calls[0]?.[0] as {
      eventType: string;
      metadata?: Record<string, unknown>;
      summary: string;
    };
    expect(timelineArg.eventType).toBe("ApplicationAssessmentUpdated");
    expect(JSON.stringify(timelineArg)).not.toContain("Strong fit");

    const auditArg = vi.mocked(writeAuditLog).mock.calls[0]?.[0] as {
      action: string;
      metadata?: Record<string, unknown>;
      description?: string;
    };
    expect(auditArg.action).toBe("recruitment.application.assessment_updated");
    expect(JSON.stringify(auditArg)).not.toContain("Strong fit");
  });

  it("clears assessment when empty string is provided", async () => {
    const service = createApplicationService(mockRepo);
    await service.updateApplicationAssessment(hrSession, {
      applicationId: "app-1",
      assessment: "   ",
    });

    expect(mockRepo.updateAssessment).toHaveBeenCalledWith(
      "app-1",
      expect.objectContaining({
        assessment: null,
        assessmentUpdatedByUserId: "user-hr",
      }),
      expect.anything()
    );

    const timelineArg = vi.mocked(RecruitmentTimelineService.append).mock.calls[0]?.[0] as {
      summary: string;
      metadata?: { cleared?: boolean };
    };
    expect(timelineArg.summary).toMatch(/cleared/i);
    expect(timelineArg.metadata?.cleared).toBe(true);
  });

  it("denies permission for non-HR sessions", async () => {
    const service = createApplicationService(mockRepo);
    await expect(
      service.updateApplicationAssessment(employeeSession, {
        applicationId: "app-1",
        assessment: "Nope",
      })
    ).rejects.toThrow(PermissionError);
    expect(mockRepo.updateAssessment).not.toHaveBeenCalled();
  });

  it("fails validation when assessment exceeds max length", async () => {
    const service = createApplicationService(mockRepo);
    await expect(
      service.updateApplicationAssessment(hrSession, {
        applicationId: "app-1",
        assessment: "x".repeat(5001),
      })
    ).rejects.toThrow(ZodError);
    expect(mockRepo.updateAssessment).not.toHaveBeenCalled();
  });

  it("propagates repository failure", async () => {
    mockRepo.updateAssessment = vi.fn(async () => {
      throw new Error("db write failed");
    });
    const service = createApplicationService(mockRepo);

    await expect(
      service.updateApplicationAssessment(hrSession, {
        applicationId: "app-1",
        assessment: "Will fail",
      })
    ).rejects.toThrow("db write failed");
  });

  it("throws when application is outside scope", async () => {
    vi.spyOn(RecruitmentScopeEngine, "canManageApplication").mockResolvedValue(false);
    const service = createApplicationService(mockRepo);

    await expect(
      service.updateApplicationAssessment(hrSession, {
        applicationId: "app-1",
        assessment: "Out of scope",
      })
    ).rejects.toThrow(PermissionError);
    expect(mockRepo.updateAssessment).not.toHaveBeenCalled();
  });

  it("throws when application is not found", async () => {
    mockRepo.getApplication = vi.fn(async () => null);
    const service = createApplicationService(mockRepo);

    await expect(
      service.updateApplicationAssessment(hrSession, {
        applicationId: "missing",
        assessment: "No app",
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });
});
