import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearApprovalRegistryForTests,
  getApprovalAdapter,
  listRegisteredApprovalCaseTypes,
  parseCaseType,
  registerApprovalAdapter,
} from "@/lib/approvals/registry";
import { mapLeaveToApprovalCase, LeaveApprovalAdapter } from "@/lib/approvals/leave-adapter";
import {
  actOnApprovalCase,
  ensureApprovalCenterRegistered,
  listApprovalCenterCases,
  resetApprovalCenterRegistrationForTests,
} from "@/lib/approvals/approval-center-service";
import { parseLeaveCaseId, toLeaveCaseId } from "@/lib/approvals/types";
import type { SessionUser } from "@/lib/session";

const getPendingApprovalsForActor = vi.fn();
const getEscalationSlaHours = vi.fn();
const advanceWorkflow = vi.fn();
const rejectWorkflow = vi.fn();
const toWorkflowActor = vi.fn((s: SessionUser) => ({
  userId: s.id,
  role: s.role,
  employeeId: s.employeeId,
}));

vi.mock("@/lib/workflow/pending-approvals", () => ({
  getPendingApprovalsForActor: (...args: unknown[]) => getPendingApprovalsForActor(...args),
}));

vi.mock("@/lib/workflow/workflow-sla", () => ({
  getEscalationSlaHours: (...args: unknown[]) => getEscalationSlaHours(...args),
}));

vi.mock("@/lib/workflow/leave-workflow", () => ({
  advanceWorkflow: (...args: unknown[]) => advanceWorkflow(...args),
  rejectWorkflow: (...args: unknown[]) => rejectWorkflow(...args),
  toWorkflowActor: (s: SessionUser) => toWorkflowActor(s),
  WorkflowError: class WorkflowError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "WorkflowError";
    }
  },
}));

const session: SessionUser = {
  id: "u1",
  email: "mgr@zebl.com",
  role: "employee",
  employeeId: 100,
  employeeName: "Manager",
  sessionVersion: 1,
  authProvider: "local",
};

describe("Approval Center façade", () => {
  beforeEach(() => {
    clearApprovalRegistryForTests();
    resetApprovalCenterRegistrationForTests();
    getPendingApprovalsForActor.mockReset();
    getEscalationSlaHours.mockReset();
    advanceWorkflow.mockReset();
    rejectWorkflow.mockReset();
    getEscalationSlaHours.mockResolvedValue(24);
  });

  describe("case id helpers", () => {
    it("round-trips leave case ids", () => {
      expect(toLeaveCaseId(42)).toBe("leave:42");
      expect(parseLeaveCaseId("leave:42")).toBe(42);
      expect(parseLeaveCaseId("offer:1")).toBeNull();
      expect(parseCaseType("leave:9")).toBe("leave");
      expect(parseCaseType("expense:1")).toBe("expense");
    });
  });

  describe("mapLeaveToApprovalCase", () => {
    it("maps leave rows into the common ApprovalCase DTO", () => {
      const mapped = mapLeaveToApprovalCase(
        {
          id: 7,
          leaveType: "EL",
          days: 2,
          startDate: new Date("2026-03-01"),
          endDate: new Date("2026-03-02"),
          employeeId: 55,
          submittedAt: new Date("2026-02-28T10:00:00Z"),
          version: 3,
          employee: { name: "Ada Lovelace" },
          currentStep: { approverRole: "manager" },
          currentStepId: 1,
        },
        24
      );

      expect(mapped.caseId).toBe("leave:7");
      expect(mapped.caseType).toBe("leave");
      expect(mapped.subjectEmployeeId).toBe(55);
      expect(mapped.status).toBe("pending");
      expect(mapped.stepLabel).toBe("Team Lead");
      expect(mapped.actions).toEqual(["approve", "reject", "view"]);
      expect(mapped.deepLink).toContain("leave:7");
      expect(mapped.version).toBe(3);
      expect(mapped.subtitle).toContain("Ada Lovelace");
      expect(mapped.slaDueAt).toEqual(new Date("2026-03-01T10:00:00Z"));
    });
  });

  describe("registry", () => {
    it("registers LeaveApprovalAdapter only by default via ensureApprovalCenterRegistered", () => {
      ensureApprovalCenterRegistered();
      expect(listRegisteredApprovalCaseTypes()).toEqual(["leave"]);
      expect(getApprovalAdapter("leave")).toBe(LeaveApprovalAdapter);
      expect(getApprovalAdapter("offer")).toBeNull();
    });

    it("allows future adapters without changing the leave registration", () => {
      ensureApprovalCenterRegistered();
      registerApprovalAdapter({
        caseType: "expense",
        listPending: async () => [],
        act: async () => ({ success: "ok" }),
      });
      expect(listRegisteredApprovalCaseTypes().sort()).toEqual(["expense", "leave"]);
    });
  });

  describe("listApprovalCenterCases", () => {
    it("returns empty when there are no pending leaves", async () => {
      getPendingApprovalsForActor.mockResolvedValue([]);
      await expect(listApprovalCenterCases(session)).resolves.toEqual([]);
    });

    it("maps pending leaves through the leave adapter", async () => {
      getPendingApprovalsForActor.mockResolvedValue([
        {
          id: 1,
          leaveType: "SL",
          days: 1,
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-04-01"),
          employeeId: 9,
          submittedAt: null,
          version: 1,
          employee: { name: "Bob" },
          currentStep: { approverRole: "skip_level_manager" },
          currentStepId: 2,
          approvalSteps: [],
        },
      ]);
      const cases = await listApprovalCenterCases(session, "leave");
      expect(cases).toHaveLength(1);
      expect(cases[0]?.caseId).toBe("leave:1");
      expect(cases[0]?.stepLabel).toBe("Manager");
    });
  });

  describe("actOnApprovalCase dispatcher", () => {
    it("dispatches approve to leave workflow", async () => {
      advanceWorkflow.mockResolvedValue({ message: "Approved." });
      const result = await actOnApprovalCase(session, "leave:15", {
        action: "approve",
        version: 2,
      });
      expect(result).toEqual({ success: "Approved." });
      expect(advanceWorkflow).toHaveBeenCalledWith(
        15,
        expect.objectContaining({ userId: "u1", employeeId: 100 }),
        2
      );
    });

    it("dispatches reject to leave workflow", async () => {
      rejectWorkflow.mockResolvedValue({ message: "Rejected." });
      const result = await actOnApprovalCase(session, "leave:15", {
        action: "reject",
        comment: "Not enough coverage this week",
        version: 2,
      });
      expect(result).toEqual({ success: "Rejected." });
      expect(rejectWorkflow).toHaveBeenCalled();
    });

    it("returns error when leave workflow denies the actor", async () => {
      const { WorkflowError } = await import("@/lib/workflow/leave-workflow");
      advanceWorkflow.mockRejectedValue(new WorkflowError("You are not authorized to approve this request."));
      const result = await actOnApprovalCase(session, "leave:15", { action: "approve" });
      expect(result.error).toContain("not authorized");
    });

    it("rejects unregistered case types", async () => {
      ensureApprovalCenterRegistered();
      const result = await actOnApprovalCase(session, "offer:1", { action: "approve" });
      expect(result.error).toMatch(/No approval adapter/);
    });
  });
});
