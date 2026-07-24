import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildPendingAccrualReasons,
  getCalendarYear,
  getElAccrualMonthKeys,
  isEligibleForEL,
} from "@/lib/leave";
import { DEFAULT_CL_ANNUAL, DEFAULT_SL_ANNUAL, EL_MONTHLY_ACCRUAL } from "@/lib/leave-types";

describe("buildPendingAccrualReasons", () => {
  it("includes CL and SL yearly reasons for the given year", () => {
    const joiningDate = new Date(); // not EL-eligible (< 1 year)
    joiningDate.setMonth(joiningDate.getMonth() - 2);

    const pending = buildPendingAccrualReasons(joiningDate, 2026, new Date("2026-07-01"));
    expect(pending).toEqual([
      { reason: "CL yearly allocation 2026", leaveType: "CL", amount: DEFAULT_CL_ANNUAL },
      { reason: "SL yearly allocation 2026", leaveType: "SL", amount: DEFAULT_SL_ANNUAL },
    ]);
  });

  it("adds EL monthly reasons when eligible, matching getElAccrualMonthKeys", () => {
    const asOf = new Date("2026-07-15");
    const joiningDate = new Date("2024-01-10");
    expect(isEligibleForEL(joiningDate, asOf)).toBe(true);

    const pending = buildPendingAccrualReasons(joiningDate, 2026, asOf);
    const el = pending.filter((p) => p.leaveType === "EL");
    const keys = getElAccrualMonthKeys(joiningDate, asOf);

    expect(el.map((p) => p.reason)).toEqual(keys.map((k) => `EL monthly accrual ${k}`));
    expect(el.every((p) => p.amount === EL_MONTHLY_ACCRUAL)).toBe(true);
    expect(pending[0]?.reason).toBe("CL yearly allocation 2026");
    expect(pending[1]?.reason).toBe("SL yearly allocation 2026");
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
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { processPendingLeaveAccruals, getLeaveBalanceSummaries } from "@/lib/leave";

describe("processPendingLeaveAccruals query depth", () => {
  beforeEach(() => {
    vi.mocked(prisma.employee.findUnique).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(prisma.leaveTransaction.findMany).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockReset();
  });

  it("batches accrual existence into one findMany and parallels it with balance ensure", async () => {
    const joiningDate = new Date();
    joiningDate.setMonth(joiningDate.getMonth() - 3);

    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      id: 1,
      joiningDate,
    } as never);

    let findManyCalls = 0;
    let balanceCalls = 0;
    let maxInFlight = 0;
    let inFlight = 0;

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        employeeLeaveBalance: {
          findUnique: async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            balanceCalls += 1;
            await Promise.resolve();
            inFlight -= 1;
            return {
              id: 1,
              employeeId: 1,
              elBalance: 0,
              clBalance: 10,
              slBalance: 8,
            };
          },
          create: vi.fn(),
          update: vi.fn(),
        },
        leaveTransaction: {
          findMany: async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            findManyCalls += 1;
            await Promise.resolve();
            inFlight -= 1;
            return [
              { reason: `CL yearly allocation ${getCalendarYear()}` },
              { reason: `SL yearly allocation ${getCalendarYear()}` },
            ];
          },
          create: vi.fn(),
        },
      };
      return fn(tx as never);
    });

    const result = await processPendingLeaveAccruals(1);
    expect(result.joiningDate).toEqual(joiningDate);
    expect(findManyCalls).toBe(1);
    expect(balanceCalls).toBe(1);
    expect(maxInFlight).toBe(2);
  });

  it("is idempotent: does not create when all candidate reasons already exist", async () => {
    const joiningDate = new Date();
    joiningDate.setMonth(joiningDate.getMonth() - 2);
    const year = getCalendarYear();

    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      id: 9,
      joiningDate,
    } as never);

    const create = vi.fn();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        employeeLeaveBalance: {
          findUnique: async () => ({
            id: 1,
            employeeId: 9,
            elBalance: 0,
            clBalance: 10,
            slBalance: 8,
          }),
          create: vi.fn(),
          update: vi.fn(),
        },
        leaveTransaction: {
          findMany: async () => [
            { reason: `CL yearly allocation ${year}` },
            { reason: `SL yearly allocation ${year}` },
          ],
          create,
        },
      };
      return fn(tx as never);
    });

    await processPendingLeaveAccruals(9);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("getLeaveBalanceSummaries with processAccruals", () => {
  beforeEach(() => {
    vi.mocked(prisma.employee.findUnique).mockReset();
    vi.mocked(prisma.$transaction).mockReset();
    vi.mocked(prisma.leaveTransaction.groupBy).mockReset();
    vi.mocked(prisma.leaveTransaction.findMany).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockReset();
  });

  it("does not re-fetch employee after accruals (reuses joiningDate)", async () => {
    const joiningDate = new Date();
    joiningDate.setMonth(joiningDate.getMonth() - 2);

    vi.mocked(prisma.employee.findUnique).mockResolvedValue({
      id: 5,
      joiningDate,
    } as never);

    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
      const tx = {
        employeeLeaveBalance: {
          findUnique: async () => ({
            id: 1,
            employeeId: 5,
            elBalance: 0,
            clBalance: 12,
            slBalance: 8,
          }),
          create: vi.fn(),
          update: vi.fn(),
        },
        leaveTransaction: {
          findMany: async () => [
            { reason: `CL yearly allocation ${getCalendarYear()}` },
            { reason: `SL yearly allocation ${getCalendarYear()}` },
          ],
          create: vi.fn(),
        },
      };
      return fn(tx as never);
    });

    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockResolvedValue({
      id: 1,
      employeeId: 5,
      elBalance: 0,
      clBalance: 12,
      slBalance: 8,
    } as never);
    vi.mocked(prisma.leaveTransaction.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.leaveTransaction.findMany).mockResolvedValue([] as never);

    const summaries = await getLeaveBalanceSummaries(5, { processAccruals: true });

    // Only the accrual path employee lookup — no second findUnique for summaries.
    expect(prisma.employee.findUnique).toHaveBeenCalledTimes(1);
    expect(summaries).toHaveLength(3);
    expect(summaries.find((s) => s.leaveType === "CL")?.remaining).toBe(12);
  });
});
