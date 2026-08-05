import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/approvals/approval-center-service", () => ({
  listApprovalCenterCases: vi.fn(),
  actOnApprovalCase: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leaveRequest: {
      findUnique: vi.fn().mockResolvedValue({ employeeId: 9 }),
    },
  },
}));

import { getSession } from "@/lib/auth";
import { actOnApprovalCase, listApprovalCenterCases } from "@/lib/approvals/approval-center-service";
import {
  actOnApprovalCaseAction,
  listApprovalCenterAction,
} from "@/actions/approval-center";

describe("approval-center actions", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    vi.mocked(listApprovalCenterCases).mockReset();
    vi.mocked(actOnApprovalCase).mockReset();
  });

  it("listApprovalCenterAction rejects unauthenticated users", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(listApprovalCenterAction()).resolves.toEqual({
      ok: false,
      error: "Unauthorized.",
    });
  });

  it("listApprovalCenterAction returns cases", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: "1",
      email: "e@x.com",
      role: "employee",
      employeeId: 5,
      employeeName: "Pat",
      sessionVersion: 1,
      authProvider: "local",
    });
    vi.mocked(listApprovalCenterCases).mockResolvedValue([]);
    await expect(listApprovalCenterAction("leave")).resolves.toEqual({
      ok: true,
      cases: [],
    });
  });

  it("actOnApprovalCaseAction denies unauthorized callers", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const fd = new FormData();
    fd.set("caseId", "leave:1");
    fd.set("action", "approve");
    await expect(actOnApprovalCaseAction({}, fd)).resolves.toEqual({
      error: "Unauthorized.",
    });
  });

  it("actOnApprovalCaseAction dispatches approve", async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: "1",
      email: "e@x.com",
      role: "employee",
      employeeId: 5,
      employeeName: "Pat",
      sessionVersion: 1,
      authProvider: "local",
    });
    vi.mocked(actOnApprovalCase).mockResolvedValue({ success: "Approved." });
    const fd = new FormData();
    fd.set("caseId", "leave:1");
    fd.set("action", "approve");
    fd.set("version", "2");
    await expect(actOnApprovalCaseAction({}, fd)).resolves.toEqual({
      success: "Approved.",
    });
    expect(actOnApprovalCase).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 5 }),
      "leave:1",
      { action: "approve", comment: undefined, version: 2 }
    );
  });
});
