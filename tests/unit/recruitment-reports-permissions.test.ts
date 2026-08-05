import { describe, expect, it, vi, beforeEach } from "vitest";
import { PermissionError } from "@/lib/permissions";

const getSessionOrThrow = vi.fn();
const getScope = vi.fn();
const assertModuleActor = vi.fn();

vi.mock("@/lib/auth-guards", () => ({
  getSessionOrThrow: () => getSessionOrThrow(),
}));

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

vi.mock("@/lib/recruitment/permissions/permission-service", () => ({
  RecruitmentPermissionService: {
    requireModuleEnabled: vi.fn(),
  },
  toRecruitmentActor: (session: { id: string }) => ({ userId: session.id }),
}));

vi.mock("@/lib/recruitment/permissions/recruitment-scope-engine", () => ({
  RecruitmentScopeEngine: {
    getScope: () => getScope(),
    assertModuleActor: (...args: unknown[]) => assertModuleActor(...args),
  },
}));

describe("requireRecruitmentReportSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows HR users", async () => {
    getSessionOrThrow.mockResolvedValue({
      id: "hr-1",
      role: "hr",
      email: "hr@example.com",
    });
    const { requireRecruitmentReportSession } = await import(
      "@/lib/recruitment/reports/auth"
    );
    const session = await requireRecruitmentReportSession();
    expect(session.id).toBe("hr-1");
    expect(assertModuleActor).not.toHaveBeenCalled();
  });

  it("allows scoped managers via RecruitmentScopeEngine", async () => {
    getSessionOrThrow.mockResolvedValue({
      id: "mgr-1",
      role: "employee",
      email: "mgr@example.com",
      employeeId: 9,
    });
    assertModuleActor.mockResolvedValue({ mode: "assigned" });
    const { requireRecruitmentReportSession } = await import(
      "@/lib/recruitment/reports/auth"
    );
    const session = await requireRecruitmentReportSession();
    expect(session.id).toBe("mgr-1");
    expect(assertModuleActor).toHaveBeenCalled();
  });

  it("rejects users outside recruitment scope", async () => {
    getSessionOrThrow.mockResolvedValue({
      id: "out-1",
      role: "employee",
      email: "out@example.com",
    });
    assertModuleActor.mockRejectedValue(new Error("forbidden"));
    const { requireRecruitmentReportSession } = await import(
      "@/lib/recruitment/reports/auth"
    );
    await expect(requireRecruitmentReportSession()).rejects.toBeInstanceOf(
      PermissionError
    );
  });
});
