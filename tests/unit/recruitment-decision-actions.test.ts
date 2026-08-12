import { beforeEach, describe, expect, it, vi } from "vitest";
import { HiringDecisionOutcome } from "@/generated/prisma/enums";
import { PermissionError } from "@/lib/permissions";

const requireHROrSuperAdminSession = vi.fn(async () => ({
  id: "user-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 1,
  employeeName: "HR User",
  sessionVersion: 1,
  authProvider: "local",
}));

const isRecruitmentModuleEnabled = vi.fn(() => true);
const mockSubmit = vi.fn(async () => ({
  id: "dec-1",
  applicationId: "app-1",
  version: 1,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireHROrSuperAdminSession: () => requireHROrSuperAdminSession(),
  requireRecruitmentAdminSession: () => requireHROrSuperAdminSession(),
}));

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => isRecruitmentModuleEnabled(),
}));

vi.mock("@/lib/recruitment/services/hiring-decision-service", () => ({
  createHiringDecisionService: () => ({
    submit: (...args: unknown[]) => mockSubmit(...args),
  }),
}));

import { submitHiringDecisionAction } from "@/actions/recruitment-decisions";

describe("submitHiringDecisionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isRecruitmentModuleEnabled.mockReturnValue(true);
    requireHROrSuperAdminSession.mockResolvedValue({
      id: "user-hr",
      email: "hr@example.com",
      role: "hr",
      employeeId: 1,
      employeeName: "HR User",
      sessionVersion: 1,
      authProvider: "local",
    });
    mockSubmit.mockResolvedValue({
      id: "dec-1",
      applicationId: "app-1",
      version: 1,
    });
  });

  it("submits a valid decision", async () => {
    const res = await submitHiringDecisionAction(
      {},
      {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit for the role",
        strengths: "Ownership and communication",
      }
    );

    expect(res.success).toBeDefined();
    expect(res.decisionId).toBe("dec-1");
    expect(mockSubmit).toHaveBeenCalled();
  });

  it("rejects invalid Zod payload", async () => {
    const res = await submitHiringDecisionAction(
      {},
      {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "",
        strengths: "Ownership",
      }
    );

    expect(res.error).toBeDefined();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("rejects unauthorized sessions", async () => {
    requireHROrSuperAdminSession.mockRejectedValue(new PermissionError("Unauthorized"));
    const res = await submitHiringDecisionAction(
      {},
      {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit for the role",
        strengths: "Ownership and communication",
      }
    );

    expect(res.error).toBe("Unauthorized");
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("rejects when the module is disabled", async () => {
    isRecruitmentModuleEnabled.mockReturnValue(false);
    const res = await submitHiringDecisionAction(
      {},
      {
        applicationId: "app-1",
        outcome: HiringDecisionOutcome.hire,
        rationale: "Fit for the role",
        strengths: "Ownership and communication",
      }
    );

    expect(res.error).toBe("Recruitment module is disabled.");
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
