import { beforeEach, describe, expect, it, vi } from "vitest";
import { HiringTeamRole } from "@/generated/prisma/enums";
import { RecruitmentScopeEngine } from "@/lib/recruitment/permissions/recruitment-scope-engine";
import type { RecruitmentActor } from "@/lib/recruitment/types/actor";

const hiringTeamFindMany = vi.fn();
const panelistFindMany = vi.fn();
const applicationFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    hiringTeamMember: {
      findMany: (...args: unknown[]) => hiringTeamFindMany(...args),
    },
    interviewPanelist: {
      findMany: (...args: unknown[]) => panelistFindMany(...args),
    },
    application: {
      findMany: (...args: unknown[]) => applicationFindMany(...args),
    },
  },
}));

const hrActor: RecruitmentActor = {
  userId: "u-hr",
  email: "hr@example.com",
  role: "hr",
  employeeId: 10,
};

const employeeActor: RecruitmentActor = {
  userId: "u-emp",
  email: "emp@example.com",
  role: "employee",
  employeeId: 42,
};

describe("RecruitmentScopeEngine", () => {
  beforeEach(() => {
    hiringTeamFindMany.mockReset();
    panelistFindMany.mockReset();
    applicationFindMany.mockReset();
  });

  it("gives unrestricted scope to HR", async () => {
    const scope = await RecruitmentScopeEngine.resolveScope(hrActor);
    expect(scope.mode).toBe("unrestricted");
    expect(hiringTeamFindMany).not.toHaveBeenCalled();
  });

  it("gives unrestricted scope to users with recruitmentOpsAccess", async () => {
    const opsManager: RecruitmentActor = {
      userId: "u-mgr1",
      email: "mgr1.test@zebl.local",
      role: "employee",
      employeeId: 101,
      recruitmentOpsAccess: true,
    };
    const scope = await RecruitmentScopeEngine.resolveScope(opsManager);
    expect(scope.mode).toBe("unrestricted");
    expect(hiringTeamFindMany).not.toHaveBeenCalled();
    await expect(RecruitmentScopeEngine.canManageJob(opsManager)).resolves.toBe(true);
    await expect(RecruitmentScopeEngine.canManageCandidate(opsManager)).resolves.toBe(
      true
    );
  });

  it("does not grant unrestricted scope from email alone", async () => {
    const lookalike: RecruitmentActor = {
      userId: "u-fake",
      email: "mgr1.test@zebl.local",
      role: "employee",
      employeeId: 999,
      recruitmentOpsAccess: false,
    };
    hiringTeamFindMany.mockResolvedValue([]);
    panelistFindMany.mockResolvedValue([]);
    applicationFindMany.mockResolvedValue([]);
    const scope = await RecruitmentScopeEngine.resolveScope(lookalike);
    expect(scope.mode).toBe("assigned");
  });

  it("allows HR to manage jobs/candidates/applications", async () => {
    await expect(RecruitmentScopeEngine.canManageJob(hrActor)).resolves.toBe(true);
    await expect(RecruitmentScopeEngine.canManageCandidate(hrActor)).resolves.toBe(true);
    await expect(RecruitmentScopeEngine.canManageApplication(hrActor)).resolves.toBe(true);
  });

  it("denies manage capabilities for employees", async () => {
    await expect(RecruitmentScopeEngine.canManageJob(employeeActor, "job-1")).resolves.toBe(
      false
    );
  });

  it("resolves assigned job/application/candidate ids for hiring team", async () => {
    hiringTeamFindMany.mockResolvedValue([
      { jobOpeningId: "job-1", role: HiringTeamRole.hiring_manager },
    ]);
    panelistFindMany.mockResolvedValue([]);
    applicationFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "app-1", candidateId: "cand-1" }]);

    const scope = await RecruitmentScopeEngine.resolveScope({
      ...employeeActor,
      userId: "u-emp-2",
    });

    expect(scope.mode).toBe("assigned");
    expect(scope.jobOpeningIds).toContain("job-1");
    expect(scope.applicationIds).toContain("app-1");
    expect(scope.candidateIds).toContain("cand-1");
    expect(scope.capabilities.isHiringManager).toBe(true);
  });

  it("canInterview requires interviewer capability for employees", async () => {
    hiringTeamFindMany.mockResolvedValue([]);
    panelistFindMany.mockResolvedValue([
      {
        interview: {
          applicationId: "app-9",
          application: { candidateId: "c-9", jobOpeningId: "j-9" },
        },
      },
    ]);
    applicationFindMany.mockResolvedValue([]);

    const actor = { ...employeeActor, userId: "u-emp-3" };
    await expect(RecruitmentScopeEngine.canInterview(actor, "app-9")).resolves.toBe(true);
    await expect(RecruitmentScopeEngine.canInterview(actor, "app-other")).resolves.toBe(false);
  });
});
