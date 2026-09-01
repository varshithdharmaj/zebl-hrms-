import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildPendingAccrualReasons, getCalendarYear } from "@/lib/leave";

const CL_ENTITLEMENT = 12;
const SL_ENTITLEMENT = 6;

const POLICY_ROW = {
  id: 1,
  cycleStartDay: 26,
  elAccrualAmount: 0.5,
  elEligibilityMonths: 12,
  elExpiryMonths: 36,
  elEncashmentCapDays: 30,
  slAnnualEntitlement: SL_ENTITLEMENT,
  slCarryForward: false,
  slExpiryMonths: null,
  clAnnualEntitlement: CL_ENTITLEMENT,
  monthlyLeaveLimit: 2,
  maxConsecutiveDays: 3,
  advanceNoticeDays: 7,
  updatedAt: new Date(),
  updatedBy: null,
};

describe("buildPendingAccrualReasons", () => {
  it("includes only CL and SL yearly reasons for the given year, using configured entitlements (EL is lot-based, handled separately)", () => {
    const pending = buildPendingAccrualReasons(
      { clAnnualEntitlement: CL_ENTITLEMENT, slAnnualEntitlement: SL_ENTITLEMENT },
      2026
    );
    expect(pending).toEqual([
      { reason: "CL yearly allocation 2026", leaveType: "CL", amount: CL_ENTITLEMENT },
      { reason: "SL yearly allocation 2026", leaveType: "SL", amount: SL_ENTITLEMENT },
    ]);
  });

  it("defaults to the current calendar year", () => {
    const pending = buildPendingAccrualReasons({
      clAnnualEntitlement: CL_ENTITLEMENT,
      slAnnualEntitlement: SL_ENTITLEMENT,
    });
    const year = getCalendarYear();
    expect(pending[0]?.reason).toBe(`CL yearly allocation ${year}`);
    expect(pending[1]?.reason).toBe(`SL yearly allocation ${year}`);
  });

  it("reflects a different configured SL entitlement (e.g. HR changes it to 10)", () => {
    const pending = buildPendingAccrualReasons(
      { clAnnualEntitlement: CL_ENTITLEMENT, slAnnualEntitlement: 10 },
      2026
    );
    expect(pending.find((p) => p.leaveType === "SL")?.amount).toBe(10);
  });
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: { findUnique: vi.fn() },
    employeeLeaveBalance: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leaveTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
    },
    leavePolicySettings: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { processPendingLeaveAccruals, getLeaveBalanceSummaries } from "@/lib/leave";

describe("processPendingLeaveAccruals query depth and transaction shape", () => {
  beforeEach(() => {
    vi.mocked(prisma.employee.findUnique).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(prisma.leaveTransaction.findMany).mockReset();
    vi.mocked(prisma.leaveTransaction.create).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.create).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.update).mockReset();
    vi.mocked(prisma.leavePolicySettings.findUnique).mockReset();
    vi.mocked(prisma.leavePolicySettings.findUnique).mockResolvedValue(POLICY_ROW as never);
  });

  it("batches the existence check with balance-ensure as one parallel round-trip (not inside a mutating transaction)", async () => {
    const joiningDate = new Date();
    joiningDate.setMonth(joiningDate.getMonth() - 3);

    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      id: 1,
      joiningDate,
      isActive: true,
    } as never);

    let findManyCalls = 0;
    let balanceCalls = 0;
    let maxInFlight = 0;
    let inFlight = 0;

    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      balanceCalls += 1;
      await Promise.resolve();
      inFlight -= 1;
      return { id: 1, employeeId: 1, elBalance: 0, clBalance: 10, slBalance: 8 } as never;
    });
    vi.mocked(prisma.leaveTransaction.findMany).mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      findManyCalls += 1;
      await Promise.resolve();
      inFlight -= 1;
      // Both CL and SL already granted this year -> nothing left to insert,
      // so no per-item $transaction call happens at all.
      return [
        { reason: `CL yearly allocation ${getCalendarYear()}` },
        { reason: `SL yearly allocation ${getCalendarYear()}` },
      ] as never;
    });

    const result = await processPendingLeaveAccruals(1);
    expect(result.joiningDate).toEqual(joiningDate);
    expect(findManyCalls).toBe(1);
    expect(balanceCalls).toBe(1);
    expect(maxInFlight).toBe(2);
    // Nothing pending -> no per-item transaction opened.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("is idempotent: does not create when all candidate reasons already exist", async () => {
    const joiningDate = new Date();
    joiningDate.setMonth(joiningDate.getMonth() - 2);
    const year = getCalendarYear();

    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      id: 9,
      joiningDate,
      isActive: true,
    } as never);
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockResolvedValue({
      id: 1,
      employeeId: 9,
      elBalance: 0,
      clBalance: 10,
      slBalance: 8,
    } as never);
    vi.mocked(prisma.leaveTransaction.findMany).mockResolvedValue([
      { reason: `CL yearly allocation ${year}` },
      { reason: `SL yearly allocation ${year}` },
    ] as never);

    await processPendingLeaveAccruals(9);
    expect(prisma.leaveTransaction.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("commits each pending item in its OWN transaction — one failure never poisons another item's insert", async () => {
    // Postgres aborts an entire transaction on the first failed statement
    // (25P02) — this test locks in that pending CL and SL accruals are each
    // committed via a separate prisma.$transaction call, so a duplicate-key
    // race on one can never take down the other (regression test for the
    // bug this exact scenario surfaced under real concurrency).
    const joiningDate = new Date();
    joiningDate.setMonth(joiningDate.getMonth() - 2);

    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      id: 12,
      joiningDate,
      isActive: true,
    } as never);
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockResolvedValue({
      id: 1,
      employeeId: 12,
      elBalance: 0,
      clBalance: 0,
      slBalance: 0,
    } as never);
    vi.mocked(prisma.leaveTransaction.findMany).mockResolvedValue([] as never);

    let transactionCalls = 0;
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      transactionCalls += 1;
      const tx = {
        employeeLeaveBalance: {
          findUnique: async () => ({ id: 1, employeeId: 12, elBalance: 0, clBalance: 0, slBalance: 0 }),
          create: vi.fn(),
          update: vi.fn(),
        },
        leaveTransaction: { create: vi.fn() },
      };
      return (fn as (tx: unknown) => Promise<unknown>)(tx);
    });

    await processPendingLeaveAccruals(12);
    // Two pending items (CL + SL) -> two separate transaction calls.
    expect(transactionCalls).toBe(2);
  });
});

describe("getLeaveBalanceSummaries with processAccruals", () => {
  beforeEach(() => {
    vi.mocked(prisma.employee.findUnique).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(prisma.leaveTransaction.groupBy).mockReset();
    vi.mocked(prisma.leaveTransaction.findMany).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockReset();
    vi.mocked(prisma.leavePolicySettings.findUnique).mockReset();
    vi.mocked(prisma.leavePolicySettings.findUnique).mockResolvedValue(POLICY_ROW as never);
  });

  it("does not re-fetch employee after accruals (reuses joiningDate)", async () => {
    const joiningDate = new Date();
    joiningDate.setMonth(joiningDate.getMonth() - 2);

    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      id: 5,
      joiningDate,
    } as never);

    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockResolvedValue({
      id: 1,
      employeeId: 5,
      elBalance: 0,
      clBalance: 12,
      slBalance: 8,
    } as never);
    // Both already granted this year -> processPendingLeaveAccruals has
    // nothing pending, so no $transaction call is needed for accrual.
    vi.mocked(prisma.leaveTransaction.findMany).mockResolvedValue([
      { reason: `CL yearly allocation ${getCalendarYear()}` },
      { reason: `SL yearly allocation ${getCalendarYear()}` },
    ] as never);
    vi.mocked(prisma.leaveTransaction.groupBy).mockResolvedValue([] as never);

    const summaries = await getLeaveBalanceSummaries(5, { processAccruals: true });

    // Only the accrual path employee lookup — no second findUnique for summaries.
    expect(prisma.employee.findUnique).toHaveBeenCalledTimes(1);
    expect(summaries).toHaveLength(3);
    expect(summaries.find((s) => s.leaveType === "CL")?.remaining).toBe(12);
  });
});
