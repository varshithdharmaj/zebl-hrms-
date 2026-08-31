import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employeeLeaveBalance: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    leaveTransaction: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    leavePolicySettings: {
      findUnique: vi.fn(),
    },
    employee: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Confirmed policy (VEB HR Policy Manual v1.0): EL eligibility = 12 months.
const DEFAULT_POLICY_ROW = {
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
};

vi.mock("@/lib/auth", () => ({
  getApplicationSession: vi.fn(),
}));

vi.mock("@/lib/auth-guards", () => ({
  requireAdminSession: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getApplicationSession } from "@/lib/auth";
import {
  buildLeaveBalanceSummariesFromParts,
  getLeaveBalanceSummariesForEmployees,
} from "@/lib/leave";
import { getAdminLeaveBalancesOverview } from "@/actions/leave-balances";

describe("buildLeaveBalanceSummariesFromParts", () => {
  it("aggregates deductions, accruals, and manual adjustments like the single-employee path", () => {
    const joiningDate = new Date("2020-01-01");
    const summaries = buildLeaveBalanceSummariesFromParts(
      { eligible: true, eligibilityDate: joiningDate },
      { elBalance: 5, clBalance: 22, slBalance: 8 },
      [
        { leaveType: "CL", transactionType: "accrual", _sum: { amount: 3 } },
        { leaveType: "CL", transactionType: "deduction", _sum: { amount: 2 } },
      ],
      [
        { leaveType: "CL", amount: 1.5 },
        { leaveType: "CL", amount: -0.5 },
      ]
    );

    const cl = summaries.find((s) => s.leaveType === "CL")!;
    expect(cl.used).toBe(2.5);
    expect(cl.remaining).toBe(22);
    expect(cl.total).toBe(24.5);
    expect(cl.eligible).toBe(true);
  });

  it("marks EL ineligible before one year and attaches note", () => {
    const eligibilityDate = new Date();
    eligibilityDate.setMonth(eligibilityDate.getMonth() + 11);
    const summaries = buildLeaveBalanceSummariesFromParts(
      { eligible: false, eligibilityDate },
      { elBalance: 0, clBalance: 0, slBalance: 0 },
      [],
      []
    );
    const el = summaries.find((s) => s.leaveType === "EL")!;
    expect(el.eligible).toBe(false);
    expect(el.note).toMatch(/Eligible from/);
  });

  it("handles zero balances and empty transaction sets", () => {
    const summaries = buildLeaveBalanceSummariesFromParts(
      { eligible: true, eligibilityDate: new Date("2018-01-01") },
      { elBalance: 0, clBalance: 0, slBalance: 0 },
      [],
      []
    );
    expect(summaries).toHaveLength(3);
    for (const s of summaries) {
      expect(s.remaining).toBe(0);
      expect(s.used).toBe(0);
      expect(s.total).toBe(0);
    }
  });

  it("supports negative remaining when present on the balance row", () => {
    const summaries = buildLeaveBalanceSummariesFromParts(
      { eligible: true, eligibilityDate: new Date("2018-01-01") },
      { elBalance: -1, clBalance: 0, slBalance: 0 },
      [{ leaveType: "EL", transactionType: "deduction", _sum: { amount: 2 } }],
      []
    );
    const el = summaries.find((s) => s.leaveType === "EL")!;
    expect(el.remaining).toBe(-1);
    expect(el.used).toBe(2);
    expect(el.total).toBe(1);
  });
});

describe("getLeaveBalanceSummariesForEmployees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.leavePolicySettings.findUnique).mockResolvedValue(DEFAULT_POLICY_ROW as never);
  });

  it("returns empty map for empty employee set without querying", async () => {
    const map = await getLeaveBalanceSummariesForEmployees([]);
    expect(map.size).toBe(0);
    expect(prisma.employeeLeaveBalance.createMany).not.toHaveBeenCalled();
  });

  it("ensures balance rows once then batches reads and groups by employeeId", async () => {
    vi.mocked(prisma.employeeLeaveBalance.createMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.employeeLeaveBalance.findMany).mockResolvedValue([
      {
        employeeId: 1,
        elBalance: 1,
        clBalance: 2,
        slBalance: 3,
      },
      {
        employeeId: 2,
        elBalance: 0,
        clBalance: 10,
        slBalance: 0,
      },
    ] as never);
    vi.mocked(prisma.leaveTransaction.groupBy).mockResolvedValue([
      {
        employeeId: 1,
        leaveType: "CL",
        transactionType: "deduction",
        _sum: { amount: 1 },
      },
      {
        employeeId: 2,
        leaveType: "CL",
        transactionType: "accrual",
        _sum: { amount: 12 },
      },
    ] as never);
    vi.mocked(prisma.leaveTransaction.findMany).mockResolvedValue([
      { employeeId: 2, leaveType: "CL", amount: -0.5 },
    ] as never);

    const map = await getLeaveBalanceSummariesForEmployees([
      { id: 1, joiningDate: new Date("2019-01-01") },
      { id: 2, joiningDate: new Date("2019-06-01") },
    ]);

    expect(prisma.employeeLeaveBalance.createMany).toHaveBeenCalledWith({
      data: [{ employeeId: 1 }, { employeeId: 2 }],
      skipDuplicates: true,
    });
    expect(prisma.leaveTransaction.groupBy).toHaveBeenCalledWith({
      by: ["employeeId", "leaveType", "transactionType"],
      where: { employeeId: { in: [1, 2] } },
      _sum: { amount: true },
    });
    expect(prisma.leaveTransaction.findMany).toHaveBeenCalledWith({
      where: {
        employeeId: { in: [1, 2] },
        transactionType: "manual_adjustment",
      },
      select: {
        employeeId: true,
        leaveType: true,
        amount: true,
      },
    });

    const emp1Cl = map.get(1)!.find((s) => s.leaveType === "CL")!;
    expect(emp1Cl.remaining).toBe(2);
    expect(emp1Cl.used).toBe(1);

    const emp2Cl = map.get(2)!.find((s) => s.leaveType === "CL")!;
    expect(emp2Cl.remaining).toBe(10);
    expect(emp2Cl.used).toBe(0.5);
  });

  it("treats missing balance rows as zeros after createMany", async () => {
    vi.mocked(prisma.employeeLeaveBalance.createMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.employeeLeaveBalance.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.leaveTransaction.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.leaveTransaction.findMany).mockResolvedValue([] as never);

    const map = await getLeaveBalanceSummariesForEmployees([
      { id: 99, joiningDate: new Date("2018-01-01") },
    ]);
    const row = map.get(99)!;
    expect(row.every((s) => s.remaining === 0 && s.used === 0)).toBe(true);
  });
});

describe("getAdminLeaveBalancesOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.leavePolicySettings.findUnique).mockResolvedValue(DEFAULT_POLICY_ROW as never);
  });

  it("returns [] when unauthorized", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue(null);
    await expect(getAdminLeaveBalancesOverview()).resolves.toEqual([]);
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it("excludes resigned employees and returns overview rows in name order", async () => {
    vi.mocked(getApplicationSession).mockResolvedValue({
      id: "hr-1",
      role: "hr",
      email: "hr@zebl.com",
    } as never);
    vi.mocked(prisma.employee.findMany).mockResolvedValue([
      {
        id: 1,
        employeeCode: "E1",
        name: "Ada",
        department: "Eng",
        joiningDate: new Date("2019-01-01"),
      },
    ] as never);
    vi.mocked(prisma.employeeLeaveBalance.createMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.employeeLeaveBalance.findMany).mockResolvedValue([
      { employeeId: 1, elBalance: 1, clBalance: 2, slBalance: 3 },
    ] as never);
    vi.mocked(prisma.leaveTransaction.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.leaveTransaction.findMany).mockResolvedValue([] as never);

    const rows = await getAdminLeaveBalancesOverview();

    expect(prisma.employee.findMany).toHaveBeenCalledWith({
      where: { employeeStatus: { not: "Resigned" } },
      orderBy: { name: "asc" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      employeeId: 1,
      employeeCode: "E1",
      name: "Ada",
      department: "Eng",
    });
    expect(rows[0]!.balances).toHaveLength(3);
  });
});
