import { beforeEach, describe, expect, it, vi } from "vitest";
import { HiringDecisionOutcome } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/session";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { PermissionError } from "@/lib/permissions";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import { emptyRecruitmentScope, unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";
import type { DecisionRepository } from "@/lib/recruitment/repositories/decision-repository";
import type { ApplicationRepository } from "@/lib/recruitment/repositories/application-repository";

const isRecruitmentModuleEnabled = vi.fn(() => true);
const flush = vi.fn(async () => undefined);
const enqueued: unknown[] = [];

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => isRecruitmentModuleEnabled(),
}));

vi.mock("@/lib/recruitment/shared/after-commit", () => ({
  createAfterCommitBuffer: () => ({
    enqueue: (event: unknown) => enqueued.push(event),
    flush,
    get size() {
      return enqueued.length;
    },
  }),
}));

vi.mock("@/lib/recruitment/shared/transaction", () => ({
  withRecruitmentTransaction: async <T>(work: (tx: unknown) => Promise<T>) => work({}),
}));

import { createHiringDecisionService } from "@/lib/recruitment/services/hiring-decision-service";

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

const saSession: SessionUser = {
  ...hrSession,
  id: "user-sa",
  email: "sa@example.com",
  role: "super_admin",
  employeeName: "Super Admin",
};

const employeeSession: SessionUser = {
  ...hrSession,
  id: "user-emp",
  email: "emp@example.com",
  role: "employee",
  employeeId: 2,
  employeeName: "Employee",
};

const managerSession: SessionUser = {
  ...employeeSession,
  id: "user-mgr",
  email: "manager@example.com",
  employeeName: "Hiring Manager",
};

const teamLeadSession: SessionUser = {
  ...employeeSession,
  id: "user-tl",
  email: "tl@example.com",
  employeeName: "Team Lead",
};

const v1 = {
  id: "dec-1",
  applicationId: "app-1",
  outcome: HiringDecisionOutcome.hire,
  rationale: "Fit",
  strengths: "Ownership",
  concerns: null,
  salaryRecommendation: null,
  currency: null,
  version: 1,
  isCurrent: true,
  decidedByUserId: "user-hr",
  decidedByEmail: "hr@example.com",
  decidedAt: new Date("2026-08-01T10:00:00.000Z"),
  createdAt: new Date("2026-08-01T10:00:00.000Z"),
};

describe("HiringDecisionService", () => {
  let mockDecisionRepo: DecisionRepository;
  let mockAppRepo: ApplicationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    enqueued.length = 0;
    isRecruitmentModuleEnabled.mockReturnValue(true);
    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue(unrestrictedRecruitmentScope());
    mockDecisionRepo = {
      appendDecision: vi.fn(async () => ({ ...v1 })),
      findCurrent: vi.fn(async () => ({ ...v1 })),
      listByApplication: vi.fn(async () => [{ ...v1 }]),
    };
    mockAppRepo = {
      getApplication: vi.fn(async () => ({
        id: "app-1",
        candidateId: "cand-1",
        jobOpeningId: "job-1",
        deletedAt: null,
      })),
    } as unknown as ApplicationRepository;
  });

  it("allows HR to submit", async () => {
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    const result = await service.submit(hrSession, {
      applicationId: "app-1",
      outcome: HiringDecisionOutcome.hire,
      rationale: "Fit",
      strengths: "Ownership",
    });
    expect(result.id).toBe("dec-1");
    expect(mockDecisionRepo.appendDecision).toHaveBeenCalled();
  });

  it("allows Super Admin to submit", async () => {
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    await expect(
      service.submit(saSession, {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.strong_hire,
        rationale: "Exceptional",
        strengths: "Leadership",
      })
    ).resolves.toMatchObject({ id: "dec-1" });
  });

  it("denies Employee", async () => {
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    await expect(
      service.submit(employeeSession, {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit",
        strengths: "Ownership",
      })
    ).rejects.toThrow(PermissionError);
    expect(mockDecisionRepo.appendDecision).not.toHaveBeenCalled();
  });

  it("denies Manager", async () => {
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    await expect(
      service.submit(managerSession, {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit",
        strengths: "Ownership",
      })
    ).rejects.toThrow(PermissionError);
  });

  it("denies Team Lead", async () => {
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    await expect(
      service.submit(teamLeadSession, {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit",
        strengths: "Ownership",
      })
    ).rejects.toThrow(PermissionError);
  });

  it("denies when application is outside scope", async () => {
    vi.spyOn(RecruitmentScopeEngine, "getScope").mockResolvedValue(emptyRecruitmentScope());
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    await expect(
      service.submit(hrSession, {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit",
        strengths: "Ownership",
      })
    ).rejects.toThrow(RecruitmentDomainError);
    expect(mockDecisionRepo.appendDecision).not.toHaveBeenCalled();
  });

  it("denies when module is disabled", async () => {
    isRecruitmentModuleEnabled.mockReturnValue(false);
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    await expect(
      service.submit(hrSession, {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit",
        strengths: "Ownership",
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });

  it("throws when application is missing", async () => {
    mockAppRepo.getApplication = vi.fn(async () => null);
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    await expect(
      service.submit(hrSession, {
        applicationId: "missing",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit",
        strengths: "Ownership",
      })
    ).rejects.toThrow(RecruitmentDomainError);
  });

  it("creates first decision as version 1", async () => {
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    const result = await service.submit(hrSession, {
      applicationId: "app-1",
      outcome: HiringDecisionOutcome.hire,
      rationale: "Fit",
      strengths: "Ownership",
    });
    expect(result.version).toBe(1);
  });

  it("revision creates version 2 and keeps historical fields unchanged", async () => {
    const historical = { ...v1, isCurrent: false };
    mockDecisionRepo.appendDecision = vi.fn(async () => ({
      ...v1,
      id: "dec-2",
      outcome: HiringDecisionOutcome.strong_hire,
      rationale: "Updated rationale",
      strengths: "Updated strengths",
      version: 2,
      isCurrent: true,
    }));
    mockDecisionRepo.findCurrent = vi.fn(async () => historical);
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    const result = await service.submit(hrSession, {
      applicationId: "app-1",
      outcome: HiringDecisionOutcome.strong_hire,
      rationale: "Updated rationale",
      strengths: "Updated strengths",
    });

    expect(result.version).toBe(2);
    expect(result.isCurrent).toBe(true);
    expect(historical.rationale).toBe("Fit");
    expect(historical.strengths).toBe("Ownership");
    expect(historical.isCurrent).toBe(false);
  });

  it("publishes HiringDecisionSubmitted after commit", async () => {
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);
    await service.submit(hrSession, {
      applicationId: "app-1",
      outcome: HiringDecisionOutcome.hire,
      rationale: "Fit",
      strengths: "Ownership",
    });

    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      type: "HiringDecisionSubmitted",
      payload: {
        decisionId: "dec-1",
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        version: 1,
      },
    });
    expect(JSON.stringify(enqueued[0])).not.toContain("Fit");
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("does not publish event when the transaction fails", async () => {
    mockDecisionRepo.appendDecision = vi.fn(async () => {
      throw new Error("db write failed");
    });
    const service = createHiringDecisionService(mockDecisionRepo, mockAppRepo);

    await expect(
      service.submit(hrSession, {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit",
        strengths: "Ownership",
      })
    ).rejects.toThrow("db write failed");

    expect(flush).not.toHaveBeenCalled();
  });
});
