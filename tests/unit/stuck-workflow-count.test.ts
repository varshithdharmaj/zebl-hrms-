import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveWorkflowStatus } from "@/generated/prisma/enums";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leaveRequest: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { getStuckWorkflowCount } from "@/lib/workflow/workflow-integrity";

describe("getStuckWorkflowCount", () => {
  beforeEach(() => {
    vi.mocked(prisma.leaveRequest.count).mockReset();
  });

  it("counts pending_approval rows with submittedAt older than 7 days", async () => {
    vi.mocked(prisma.leaveRequest.count).mockResolvedValue(3);

    const before = Date.now();
    const count = await getStuckWorkflowCount();
    const after = Date.now();

    expect(count).toBe(3);
    expect(prisma.leaveRequest.count).toHaveBeenCalledTimes(1);

    const arg = vi.mocked(prisma.leaveRequest.count).mock.calls[0]?.[0];
    expect(arg?.where?.workflowStatus).toBe(LeaveWorkflowStatus.pending_approval);
    const submittedAt = arg?.where?.submittedAt as { not: null; lt: Date };
    expect(submittedAt.not).toBeNull();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(submittedAt.lt.getTime()).toBeGreaterThanOrEqual(before - sevenDaysMs - 5);
    expect(submittedAt.lt.getTime()).toBeLessThanOrEqual(after - sevenDaysMs + 5);
  });

  it("returns zero when none are stuck", async () => {
    vi.mocked(prisma.leaveRequest.count).mockResolvedValue(0);
    await expect(getStuckWorkflowCount()).resolves.toBe(0);
  });
});
