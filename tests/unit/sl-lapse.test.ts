import { describe, expect, it, vi, beforeEach } from "vitest";

const { POLICY_ROW } = vi.hoisted(() => ({
  POLICY_ROW: {
    id: 1,
    cycleStartDay: 26,
    elAccrualAmount: 0.5,
    elEligibilityMonths: 12,
    elExpiryMonths: 36,
    elEncashmentCapDays: 30,
    slAnnualEntitlement: 6,
    slCarryForward: false,
    slExpiryMonths: null,
    clAnnualEntitlement: 12,
    monthlyLeaveLimit: 2,
    maxConsecutiveDays: 3,
    advanceNoticeDays: 7,
    updatedAt: new Date(),
    updatedBy: null,
  },
}));

function makeMockPrisma() {
  const employeeLeaveBalance = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
  const leaveTransaction = {
    findMany: vi.fn(),
    create: vi.fn(),
  };
  const employee = { findUnique: vi.fn() };
  const leavePolicySettings = { findUnique: vi.fn().mockResolvedValue(POLICY_ROW) };

  const tx = { employeeLeaveBalance, leaveTransaction, employee, leavePolicySettings };
  const $transaction = vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx));

  return { employeeLeaveBalance, leaveTransaction, employee, leavePolicySettings, $transaction };
}

vi.mock("@/lib/prisma", () => ({ prisma: makeMockPrisma() }));

import { prisma } from "@/lib/prisma";
import { processPendingLeaveAccruals } from "@/lib/leave";

describe("SL year-end lapse (slCarryForward: false)", () => {
  beforeEach(() => {
    vi.mocked(prisma.employee.findUnique).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.update).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.updateMany).mockReset();
    vi.mocked(prisma.leaveTransaction.findMany).mockReset();
    vi.mocked(prisma.leaveTransaction.create).mockReset();
    vi.mocked(prisma.leavePolicySettings.findUnique).mockResolvedValue(POLICY_ROW as never);
  });

  it("forfeits unused SL before granting the new year's allocation", async () => {
    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      id: 1,
      joiningDate: new Date(2020, 0, 1),
      isActive: true,
    } as never);
    // Employee has 4 unused SL left over (never lapsed before), and last
    // year's grant already exists but not this year's.
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockResolvedValue({
      id: 1,
      employeeId: 1,
      elBalance: 0,
      clBalance: 0,
      slBalance: 4,
    } as never);
    const priorYear = new Date().getFullYear() - 1;
    vi.mocked(prisma.leaveTransaction.findMany).mockResolvedValue([
      { reason: `SL yearly allocation ${priorYear}` },
      { reason: `CL yearly allocation ${priorYear}` },
    ] as never);

    const createCalls: unknown[] = [];
    vi.mocked(prisma.leaveTransaction.create).mockImplementation(async (args) => {
      createCalls.push(args);
      return {} as never;
    });

    await processPendingLeaveAccruals(1);

    const reasons = createCalls.map((c: any) => c.data.reason);
    expect(reasons).toContain(`SL yearly lapse ${priorYear}`);
    expect(reasons.some((r: string) => r.startsWith("SL yearly allocation"))).toBe(true);
    expect(reasons.some((r: string) => r.startsWith("CL yearly allocation"))).toBe(true);

    // The lapse must have decremented the balance before the new grant
    // incremented it — verify a negative-amount expiry-type transaction was recorded.
    const lapseCall = createCalls.find(
      (c: any) => c.data.reason === `SL yearly lapse ${priorYear}`
    ) as any;
    expect(lapseCall.data.transactionType).toBe("expiry");
    expect(lapseCall.data.amount).toBe(4); // stored as Math.abs per ledger convention
  });

  it("does not lapse when slBalance is already 0 (nothing to forfeit)", async () => {
    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      id: 2,
      joiningDate: new Date(2020, 0, 1),
      isActive: true,
    } as never);
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockResolvedValue({
      id: 2,
      employeeId: 2,
      elBalance: 0,
      clBalance: 0,
      slBalance: 0,
    } as never);
    vi.mocked(prisma.leaveTransaction.findMany).mockResolvedValue([] as never);

    const createCalls: unknown[] = [];
    vi.mocked(prisma.leaveTransaction.create).mockImplementation(async (args) => {
      createCalls.push(args);
      return {} as never;
    });

    await processPendingLeaveAccruals(2);

    const reasons = createCalls.map((c: any) => c.data.reason);
    expect(reasons.some((r: string) => r.startsWith("SL yearly lapse"))).toBe(false);
  });

  it("does not lapse again once this year's SL has already been granted (idempotent)", async () => {
    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      id: 3,
      joiningDate: new Date(2020, 0, 1),
      isActive: true,
    } as never);
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockResolvedValue({
      id: 3,
      employeeId: 3,
      elBalance: 0,
      clBalance: 0,
      slBalance: 6,
    } as never);
    const year = new Date().getFullYear();
    vi.mocked(prisma.leaveTransaction.findMany).mockResolvedValue([
      { reason: `SL yearly allocation ${year}` },
      { reason: `CL yearly allocation ${year}` },
    ] as never);

    const createCalls: unknown[] = [];
    vi.mocked(prisma.leaveTransaction.create).mockImplementation(async (args) => {
      createCalls.push(args);
      return {} as never;
    });

    await processPendingLeaveAccruals(3);

    // This year's allocations already exist, so nothing new should be created at all.
    expect(createCalls).toHaveLength(0);
  });
});
