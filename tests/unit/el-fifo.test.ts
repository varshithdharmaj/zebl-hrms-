import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { leaveConsumption: { count: vi.fn() } },
}));

import { consumeElFifo, restoreElForCancellation } from "@/lib/leave/el-fifo";

type Lot = { id: number; accrualDate: Date; remaining: number; expiryDate: Date };

function makeFakeTx(lots: Lot[]) {
  const state = new Map(lots.map((l) => [l.id, { ...l }]));
  const consumptions: { leaveRequestId: number; elAccrualLotId: number; amount: number }[] = [];
  const leaveTransactions: Record<string, unknown>[] = [];
  const balance = { employeeId: 5, elBalance: lots.reduce((s, l) => s + l.remaining, 0) };

  const tx = {
    elAccrualLot: {
      findMany: vi.fn(async ({ where }: { where: { expiryDate?: { gt: Date } } }) => {
        const now = where.expiryDate?.gt ?? new Date(0);
        return [...state.values()]
          .filter((l) => l.remaining > 0 && l.expiryDate > now)
          .sort((a, b) => a.accrualDate.getTime() - b.accrualDate.getTime());
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: number; remaining: { gte: number } }; data: { remaining: { decrement: number } } }) => {
        const lot = state.get(where.id);
        if (!lot || lot.remaining < where.remaining.gte) return { count: 0 };
        lot.remaining -= data.remaining.decrement;
        return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: { remaining: { increment: number } } }) => {
        const lot = state.get(where.id);
        if (!lot) throw new Error("lot not found");
        lot.remaining += data.remaining.increment;
        return lot;
      }),
    },
    leaveConsumption: {
      create: vi.fn(async ({ data }: { data: { leaveRequestId: number; elAccrualLotId: number; amount: number } }) => {
        consumptions.push(data);
        return data;
      }),
      findMany: vi.fn(async ({ where }: { where: { leaveRequestId: number } }) =>
        consumptions.filter((c) => c.leaveRequestId === where.leaveRequestId)
      ),
    },
    employeeLeaveBalance: {
      findUnique: vi.fn(async () => balance),
      create: vi.fn(async () => balance),
      update: vi.fn(async ({ data }: { data: { elBalance?: { increment?: number } } }) => {
        if (data.elBalance?.increment) balance.elBalance += data.elBalance.increment;
        return balance;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { elBalance: { gte: number } }; data: { elBalance: { decrement: number } } }) => {
        if (balance.elBalance < where.elBalance.gte) return { count: 0 };
        balance.elBalance -= data.elBalance.decrement;
        return { count: 1 };
      }),
    },
    leaveTransaction: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        leaveTransactions.push(data);
        return data;
      }),
    },
  };

  return { tx, state, consumptions, leaveTransactions };
}

const lot = (id: number, month: number, remaining = 0.5): Lot => ({
  id,
  accrualDate: new Date(2027, month, 26),
  remaining,
  expiryDate: new Date(2030, month, 26),
});

describe("consumeElFifo", () => {
  it("consumes oldest lots first across a single day's request", async () => {
    const { tx, state } = makeFakeTx([lot(1, 2), lot(2, 3), lot(3, 4)]); // Mar, Apr, May

    await consumeElFifo(tx as never, {
      employeeId: 5,
      days: 1,
      leaveRequestId: 900,
      createdBy: "hr@zebl.com",
      asOf: new Date(2027, 5, 1),
    });

    expect(state.get(1)!.remaining).toBe(0); // Mar fully consumed
    expect(state.get(2)!.remaining).toBe(0); // Apr fully consumed
    expect(state.get(3)!.remaining).toBe(0.5); // May untouched
  });

  it("splits partial consumption across a lot boundary", async () => {
    const { tx, state, consumptions } = makeFakeTx([lot(1, 2), lot(2, 3)]);

    await consumeElFifo(tx as never, {
      employeeId: 5,
      days: 0.75,
      leaveRequestId: 901,
      createdBy: "hr@zebl.com",
      asOf: new Date(2027, 5, 1),
    });

    expect(state.get(1)!.remaining).toBe(0);
    expect(state.get(2)!.remaining).toBe(0.25);
    expect(consumptions).toEqual([
      { leaveRequestId: 901, elAccrualLotId: 1, amount: 0.5 },
      { leaveRequestId: 901, elAccrualLotId: 2, amount: 0.25 },
    ]);
  });

  it("skips expired lots even when remaining > 0", async () => {
    const expiredLot = lot(1, 0);
    expiredLot.expiryDate = new Date(2027, 0, 1); // already expired
    const { tx, state } = makeFakeTx([expiredLot, lot(2, 3)]);

    await consumeElFifo(tx as never, {
      employeeId: 5,
      days: 0.5,
      leaveRequestId: 902,
      createdBy: "hr@zebl.com",
      asOf: new Date(2027, 5, 1),
    });

    expect(state.get(1)!.remaining).toBe(0.5); // untouched
    expect(state.get(2)!.remaining).toBe(0); // consumed instead
  });

  it("throws without mutating anything when total remaining is insufficient", async () => {
    const { tx, state } = makeFakeTx([lot(1, 2, 0.5)]);

    await expect(
      consumeElFifo(tx as never, {
        employeeId: 5,
        days: 2,
        leaveRequestId: 903,
        createdBy: "hr@zebl.com",
        asOf: new Date(2027, 5, 1),
      })
    ).rejects.toThrow(/Insufficient EL balance/);

    expect(state.get(1)!.remaining).toBe(0.5); // unchanged
  });
});

describe("restoreElForCancellation", () => {
  it("restores consumed amounts to the exact original lots", async () => {
    const { tx, state } = makeFakeTx([lot(1, 2, 0), lot(2, 3, 0.25)]);
    // Simulate a prior consumption of 0.5 from lot 1 and 0.25 from lot 2 for request 901.
    await tx.leaveConsumption.create({ data: { leaveRequestId: 901, elAccrualLotId: 1, amount: 0.5 } });
    await tx.leaveConsumption.create({ data: { leaveRequestId: 901, elAccrualLotId: 2, amount: 0.25 } });

    await restoreElForCancellation(tx as never, {
      employeeId: 5,
      leaveRequestId: 901,
      createdBy: "hr@zebl.com",
      reason: "Employee no longer needs the leave",
    });

    expect(state.get(1)!.remaining).toBe(0.5);
    expect(state.get(2)!.remaining).toBe(0.5);
  });

  it("is a no-op when the request has no recorded EL consumption", async () => {
    const { tx, state } = makeFakeTx([lot(1, 2, 0.5)]);

    await restoreElForCancellation(tx as never, {
      employeeId: 5,
      leaveRequestId: 999,
      createdBy: "hr@zebl.com",
      reason: "n/a",
    });

    expect(state.get(1)!.remaining).toBe(0.5);
    expect(tx.leaveTransaction.create).not.toHaveBeenCalled();
  });
});
