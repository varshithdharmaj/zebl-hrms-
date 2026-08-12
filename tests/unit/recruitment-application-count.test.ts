import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import type { ApplicationRepository } from "@/lib/recruitment/repositories/application-repository";
import type { SessionUser } from "@/lib/session";
import { unrestrictedRecruitmentScope } from "@/lib/recruitment/types/scope";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/recruitment/permissions/recruitment-scope-engine", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/recruitment/permissions/recruitment-scope-engine")
  >("@/lib/recruitment/permissions/recruitment-scope-engine");
  return {
    ...actual,
    RecruitmentScopeEngine: {
      ...actual.RecruitmentScopeEngine,
      getScope: vi.fn(async () => unrestrictedRecruitmentScope()),
    },
  };
});

const hrSession: SessionUser = {
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
};

describe("ApplicationService.countCandidateApplications", () => {
  let countByCandidate: ReturnType<typeof vi.fn>;
  let mockRepo: ApplicationRepository;

  beforeEach(() => {
    countByCandidate = vi.fn(async () => 3);
    mockRepo = {
      countByCandidate,
    } as unknown as ApplicationRepository;
  });

  it("passes scoped candidateId to repository countByCandidate", async () => {
    const service = createApplicationService(mockRepo);
    const count = await service.countCandidateApplications(hrSession, "cand-1");

    expect(count).toBe(3);
    expect(countByCandidate).toHaveBeenCalledWith(unrestrictedRecruitmentScope(), "cand-1");
  });
});
