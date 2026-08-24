import { describe, expect, it, vi, beforeEach } from "vitest";

function makeMockPrisma() {
  const elAccrualLot = {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  };
  const employeeLeaveBalance = {
    update: vi.fn(),
  };
  const leaveTransaction = {
    create: vi.fn(),
  };

  const tx = { elAccrualLot, employeeLeaveBalance, leaveTransaction };
  const $transaction = vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx));

  return { elAccrualLot, employeeLeaveBalance, leaveTransaction, $transaction };
}

vi.mock("@/lib/prisma", () => ({ prisma: makeMockPrisma() }));

import { prisma } from "@/lib/prisma";
import { runElExpiryBatch } from "@/lib/leave/el-expiry-engine";

describe("runElExpiryBatch", () => {
  beforeEach(() => {
    vi.mocked(prisma.elAccrualLot.findMany).mockReset();
    vi.mocked(prisma.elAccrualLot.updateMany).mockReset();
    vi.mocked(prisma.employeeLeaveBalance.update).mockReset();
    vi.mocked(prisma.leaveTransaction.create).mockReset();
  });

  it("expires the full remaining amount of an untouched lot exactly at the 36-month boundary", async () => {
    vi.mocked(prisma.elAccrualLot.findMany).mockResolvedValue([
      { id: 1, employeeId: 5, remaining: 0.5 },
    ] as never);
    vi.mocked(prisma.elAccrualLot.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await runElExpiryBatch(new Date(2030, 2, 26));

    expect(result).toEqual({ lotsExpired: 1, amountExpired: 0.5 });
    expect(prisma.elAccrualLot.updateMany).toHaveBeenCalledWith({
      where: { id: 1, remaining: { gt: 0 } },
      data: { remaining: 0 },
    });
    expect(prisma.leaveTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 5,
        leaveType: "EL",
        transactionType: "expiry",
        amount: 0.5,
        elAccrualLotId: 1,
      }),
    });
    expect(prisma.employeeLeaveBalance.update).toHaveBeenCalledWith({
      where: { employeeId: 5 },
      data: { elBalance: { decrement: 0.5 } },
    });
  });

  it("expires only the unconsumed remainder of a partially-used lot", async () => {
    vi.mocked(prisma.elAccrualLot.findMany).mockResolvedValue([
      { id: 2, employeeId: 5, remaining: 0.25 },
    ] as never);
    vi.mocked(prisma.elAccrualLot.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await runElExpiryBatch(new Date(2030, 3, 1));

    expect(result.amountExpired).toBe(0.25);
  });

  it("does not query fully-consumed lots (remaining=0 is excluded by the query filter)", async () => {
    // Simulates the DB-side `remaining: { gt: 0 }` filter already excluding this lot.
    vi.mocked(prisma.elAccrualLot.findMany).mockResolvedValue([]);

    const result = await runElExpiryBatch(new Date(2030, 3, 1));

    expect(result).toEqual({ lotsExpired: 0, amountExpired: 0 });
    expect(prisma.leaveTransaction.create).not.toHaveBeenCalled();
  });

  it("is idempotent: a second run against the same (now-expired) lot is a no-op", async () => {
    // First run finds the lot with remaining=0.5.
    vi.mocked(prisma.elAccrualLot.findMany).mockResolvedValueOnce([
      { id: 3, employeeId: 5, remaining: 0.5 },
    ] as never);
    vi.mocked(prisma.elAccrualLot.updateMany).mockResolvedValue({ count: 1 } as never);
    const first = await runElExpiryBatch(new Date(2030, 2, 26));
    expect(first.lotsExpired).toBe(1);

    // Second run: DB query now excludes it (remaining=0), so findMany returns [].
    vi.mocked(prisma.elAccrualLot.findMany).mockResolvedValueOnce([]);
    const second = await runElExpiryBatch(new Date(2030, 2, 27));
    expect(second).toEqual({ lotsExpired: 0, amountExpired: 0 });
  });

  it("skips a lot whose remaining changed concurrently (updateMany count=0)", async () => {
    vi.mocked(prisma.elAccrualLot.findMany).mockResolvedValue([
      { id: 4, employeeId: 5, remaining: 0.5 },
    ] as never);
    vi.mocked(prisma.elAccrualLot.updateMany).mockResolvedValue({ count: 0 } as never);

    const result = await runElExpiryBatch(new Date(2030, 2, 26));

    expect(result).toEqual({ lotsExpired: 0, amountExpired: 0 });
    expect(prisma.leaveTransaction.create).not.toHaveBeenCalled();
  });
});
