import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    leaveRequest: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { validateLeaveRequestPolicy, getLeaveDaysInCycle } from "@/lib/leave/policy-checks";
import type { LeavePolicy } from "@/lib/leave/leave-policy";

const POLICY: LeavePolicy = {
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
};

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

describe("validateLeaveRequestPolicy", () => {
  beforeEach(() => {
    vi.mocked(prisma.leaveRequest.findMany).mockReset();
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);
  });

  it("allows a request within all limits", async () => {
    const start = daysFromNow(10);
    const result = await validateLeaveRequestPolicy({
      employeeId: 1,
      leaveType: "CL",
      startDate: start,
      endDate: start,
      days: 1,
      policy: POLICY,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects more than the max consecutive days (1/2/3 allowed, 4 rejected)", async () => {
    // Isolate the consecutive-days rule from the monthly limit (2) by raising
    // the limit here — a 3-day request would otherwise also fail that check.
    const policy: LeavePolicy = { ...POLICY, monthlyLeaveLimit: 10 };
    for (const days of [1, 2, 3]) {
      const result = await validateLeaveRequestPolicy({
        employeeId: 1,
        leaveType: "CL",
        startDate: daysFromNow(10),
        endDate: daysFromNow(10 + days - 1),
        days,
        policy,
      });
      expect(result.ok).toBe(true);
    }

    const rejected = await validateLeaveRequestPolicy({
      employeeId: 1,
      leaveType: "CL",
      startDate: daysFromNow(10),
      endDate: daysFromNow(13),
      days: 4,
      policy,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.error).toMatch(/3 consecutive days/);
  });

  it("rejects a request with less than the required advance notice for EL/CL", async () => {
    const result = await validateLeaveRequestPolicy({
      employeeId: 1,
      leaveType: "CL",
      startDate: daysFromNow(2),
      endDate: daysFromNow(2),
      days: 1,
      policy: POLICY,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/advance notice/);
  });

  it("allows a request with at least the required advance notice", async () => {
    const result = await validateLeaveRequestPolicy({
      employeeId: 1,
      leaveType: "EL",
      startDate: daysFromNow(7),
      endDate: daysFromNow(7),
      days: 1,
      policy: POLICY,
    });
    expect(result.ok).toBe(true);
  });

  it("exempts Sick Leave from the advance notice requirement (emergency/unplanned)", async () => {
    const result = await validateLeaveRequestPolicy({
      employeeId: 1,
      leaveType: "SL",
      startDate: daysFromNow(0),
      endDate: daysFromNow(0),
      days: 1,
      policy: POLICY,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects when the monthly leave limit would be exceeded (sufficient balance but over the limit)", async () => {
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([{ days: 2 }] as never);
    const result = await validateLeaveRequestPolicy({
      employeeId: 1,
      leaveType: "CL",
      startDate: daysFromNow(10),
      endDate: daysFromNow(10),
      days: 1,
      policy: POLICY,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/monthly leave limit/i);
    if (!result.ok) expect(result.error).toMatch(/Loss of Pay/);
  });

  it("allows exactly the monthly limit (2 days) but not one more", async () => {
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([]);
    const exact = await validateLeaveRequestPolicy({
      employeeId: 1,
      leaveType: "CL",
      startDate: daysFromNow(10),
      endDate: daysFromNow(11),
      days: 2,
      policy: POLICY,
    });
    expect(exact.ok).toBe(true);

    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([{ days: 2 }] as never);
    const overBy1 = await validateLeaveRequestPolicy({
      employeeId: 1,
      leaveType: "CL",
      startDate: daysFromNow(15),
      endDate: daysFromNow(15),
      days: 1,
      policy: POLICY,
    });
    expect(overBy1.ok).toBe(false);
  });
});

describe("getLeaveDaysInCycle", () => {
  it("sums days from pending/approved requests overlapping the 26th-25th cycle window", async () => {
    vi.mocked(prisma.leaveRequest.findMany).mockResolvedValue([{ days: 1 }, { days: 0.5 }] as never);
    const total = await getLeaveDaysInCycle(1, POLICY, new Date(2026, 0, 10));
    expect(total).toBe(1.5);
    expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 1,
          startDate: { lte: new Date(2026, 0, 25) },
          endDate: { gte: new Date(2025, 11, 26) },
        }),
      })
    );
  });
});
