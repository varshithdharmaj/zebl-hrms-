import { describe, expect, it, vi, beforeEach } from "vitest";

// Confirmed policy (VEB HR Policy Manual v1.0): EL eligibility is 12 months
// (completion of one year) from DOJ.
const { DEFAULT_POLICY } = vi.hoisted(() => ({
  DEFAULT_POLICY: {
    cycleStartDay: 26,
    elAccrualAmount: 0.5,
    elEligibilityMonths: 12,
    elExpiryMonths: 36,
    slAnnualEntitlement: 6,
    slCarryForward: false,
    slExpiryMonths: null,
  },
}));

function makeMockPrisma() {
  const elAccrualLot = {
    findMany: vi.fn(),
    create: vi.fn(),
  };
  const employeeLeaveBalance = {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const leaveTransaction = {
    create: vi.fn(),
  };
  const employee = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  };

  const tx = { elAccrualLot, employeeLeaveBalance, leaveTransaction, employee };
  const $transaction = vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx));

  return { elAccrualLot, employeeLeaveBalance, leaveTransaction, employee, $transaction };
}

vi.mock("@/lib/prisma", () => ({ prisma: makeMockPrisma() }));

import { prisma } from "@/lib/prisma";
import { runElAccrualForEmployee } from "@/lib/leave/el-accrual-engine";

describe("runElAccrualForEmployee", () => {
  beforeEach(() => {
    vi.mocked(prisma.elAccrualLot.findMany).mockReset();
    vi.mocked(prisma.elAccrualLot.create).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.update).mockReset();
    vi.mocked(prisma.leaveTransaction.create).mockReset();
    vi.mocked(prisma.$transaction).mockClear();
  });

  it("creates no lot for an inactive employee", async () => {
    const result = await runElAccrualForEmployee(
      { id: 1, joiningDate: new Date(2020, 0, 1), isActive: false },
      DEFAULT_POLICY,
      new Date(2027, 0, 26)
    );
    expect(result.lotsCreated).toEqual([]);
    expect(prisma.elAccrualLot.findMany).not.toHaveBeenCalled();
  });

  it("creates no lot before eligibility", async () => {
    const result = await runElAccrualForEmployee(
      { id: 1, joiningDate: new Date(2026, 0, 10), isActive: true },
      DEFAULT_POLICY,
      new Date(2026, 11, 1) // before 26-Jan-2027 first accrual
    );
    expect(result.lotsCreated).toEqual([]);
  });

  it("creates the first lot on the first eligible 26th", async () => {
    vi.mocked(prisma.elAccrualLot.findMany).mockResolvedValue([]);
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockResolvedValue({
      id: 1,
      employeeId: 1,
      elBalance: 0,
      clBalance: 0,
      slBalance: 0,
    } as never);
    vi.mocked(prisma.elAccrualLot.create).mockResolvedValue({ id: 100 } as never);

    const result = await runElAccrualForEmployee(
      { id: 1, joiningDate: new Date(2026, 0, 10), isActive: true },
      DEFAULT_POLICY,
      new Date(2027, 0, 26)
    );

    expect(result.lotsCreated).toEqual(["2027-01"]);
    expect(prisma.elAccrualLot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 1,
        cycleKey: "2027-01",
        amount: 0.5,
        remaining: 0.5,
        expiryDate: new Date(2030, 0, 26),
      }),
    });
    expect(prisma.employeeLeaveBalance.update).toHaveBeenCalledWith({
      where: { employeeId: 1 },
      data: { elBalance: { increment: 0.5 } },
    });
  });

  it("skips a cycle that already has a lot (idempotency)", async () => {
    vi.mocked(prisma.elAccrualLot.findMany).mockResolvedValue([{ cycleKey: "2027-01" }] as never);

    const result = await runElAccrualForEmployee(
      { id: 1, joiningDate: new Date(2026, 0, 10), isActive: true },
      DEFAULT_POLICY,
      new Date(2027, 0, 26)
    );

    expect(result.lotsCreated).toEqual([]);
    expect(prisma.elAccrualLot.create).not.toHaveBeenCalled();
  });

  it("running twice for the same cycle never creates a duplicate lot", async () => {
    vi.mocked(prisma.employeeLeaveBalance.findUnique).mockResolvedValue({
      id: 1,
      employeeId: 1,
      elBalance: 0,
      clBalance: 0,
      slBalance: 0,
    } as never);
    vi.mocked(prisma.elAccrualLot.create).mockResolvedValue({ id: 100 } as never);

    // First run: no existing lots.
    vi.mocked(prisma.elAccrualLot.findMany).mockResolvedValueOnce([]);
    const first = await runElAccrualForEmployee(
      { id: 1, joiningDate: new Date(2026, 0, 10), isActive: true },
      DEFAULT_POLICY,
      new Date(2027, 0, 26)
    );
    expect(first.lotsCreated).toEqual(["2027-01"]);

    // Second run: the lot now exists.
    vi.mocked(prisma.elAccrualLot.findMany).mockResolvedValueOnce([
      { cycleKey: "2027-01" },
    ] as never);
    const second = await runElAccrualForEmployee(
      { id: 1, joiningDate: new Date(2026, 0, 10), isActive: true },
      DEFAULT_POLICY,
      new Date(2027, 0, 26)
    );
    expect(second.lotsCreated).toEqual([]);
    expect(prisma.elAccrualLot.create).toHaveBeenCalledTimes(1);
  });
});
