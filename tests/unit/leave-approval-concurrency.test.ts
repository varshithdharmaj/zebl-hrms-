import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: { findUnique: vi.fn() },
    employeeLeaveBalance: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    leaveTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  deductLeaveForApproval,
  processPendingLeaveAccruals,
  recordLeaveTransactionInTx,
} from "@/lib/leave";

type Tx = {
  employeeLeaveBalance: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  leaveTransaction: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  employee: { findUnique: ReturnType<typeof vi.fn> };
};

function makeTx(): Tx {
  return {
    employeeLeaveBalance: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    leaveTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    employee: { findUnique: vi.fn() },
  };
}

describe("leave approval ledger concurrency primitives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Case 1 — normal deduction uses conditional decrement then creates ledger row", async () => {
    const tx = makeTx();
    tx.employeeLeaveBalance.findUnique.mockResolvedValue({
      employeeId: 1,
      elBalance: 0,
      clBalance: 5,
      slBalance: 0,
    });
    tx.employeeLeaveBalance.updateMany.mockResolvedValue({ count: 1 });
    tx.leaveTransaction.create.mockResolvedValue({ id: 10 });

    await recordLeaveTransactionInTx(tx as never, {
      employeeId: 1,
      leaveType: "CL",
      transactionType: "deduction",
      amount: 2,
      leaveRequestId: 99,
      createdBy: "mgr@test",
      reason: "Leave request #99 approved",
    });

    expect(tx.employeeLeaveBalance.updateMany).toHaveBeenCalledWith({
      where: { employeeId: 1, clBalance: { gte: 2 } },
      data: { clBalance: { decrement: 2 } },
    });
    expect(tx.leaveTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionType: "deduction",
          leaveRequestId: 99,
          amount: 2,
        }),
      })
    );
  });

  it("Case 4 — insufficient balance fails before ledger insert (no partial write)", async () => {
    const tx = makeTx();
    tx.employeeLeaveBalance.findUnique.mockResolvedValue({
      employeeId: 1,
      elBalance: 0,
      clBalance: 1,
      slBalance: 0,
    });
    tx.employeeLeaveBalance.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      recordLeaveTransactionInTx(tx as never, {
        employeeId: 1,
        leaveType: "CL",
        transactionType: "deduction",
        amount: 2,
        leaveRequestId: 7,
        createdBy: "mgr@test",
      })
    ).rejects.toThrow(/Insufficient CL balance/);

    expect(tx.leaveTransaction.create).not.toHaveBeenCalled();
  });

  it("Case 2 / 7 — duplicate deduction unique violation maps to clear error", async () => {
    const tx = makeTx();
    tx.employeeLeaveBalance.findUnique.mockResolvedValue({
      employeeId: 1,
      elBalance: 0,
      clBalance: 5,
      slBalance: 0,
    });
    tx.employeeLeaveBalance.updateMany.mockResolvedValue({ count: 1 });
    tx.leaveTransaction.create.mockRejectedValue({ code: "P2002" });

    await expect(
      recordLeaveTransactionInTx(tx as never, {
        employeeId: 1,
        leaveType: "CL",
        transactionType: "deduction",
        amount: 1,
        leaveRequestId: 42,
        createdBy: "mgr@test",
      })
    ).rejects.toThrow(/Leave request #42 was already deducted/);
  });

  it("Case 5 — concurrent balance consumers: only gte decrement succeeds (Scenario E shape)", async () => {
    const txA = makeTx();
    const txB = makeTx();
    for (const tx of [txA, txB]) {
      tx.employeeLeaveBalance.findUnique.mockResolvedValue({
        employeeId: 1,
        elBalance: 0,
        clBalance: 2,
        slBalance: 0,
      });
    }
    // First claim wins; second sees balance already reduced (count 0).
    txA.employeeLeaveBalance.updateMany.mockResolvedValue({ count: 1 });
    txA.leaveTransaction.create.mockResolvedValue({ id: 1 });
    txB.employeeLeaveBalance.updateMany.mockResolvedValue({ count: 0 });

    await recordLeaveTransactionInTx(txA as never, {
      employeeId: 1,
      leaveType: "CL",
      transactionType: "deduction",
      amount: 2,
      leaveRequestId: 101,
      createdBy: "a",
    });

    await expect(
      recordLeaveTransactionInTx(txB as never, {
        employeeId: 1,
        leaveType: "CL",
        transactionType: "deduction",
        amount: 2,
        leaveRequestId: 102,
        createdBy: "b",
      })
    ).rejects.toThrow(/Insufficient CL balance/);

    expect(txA.leaveTransaction.create).toHaveBeenCalledTimes(1);
    expect(txB.leaveTransaction.create).not.toHaveBeenCalled();
  });

  it("deductLeaveForApproval with outer tx does not open a nested transaction", async () => {
    const tx = makeTx();
    tx.employeeLeaveBalance.findUnique.mockResolvedValue({
      employeeId: 1,
      elBalance: 0,
      clBalance: 3,
      slBalance: 0,
    });
    tx.employeeLeaveBalance.updateMany.mockResolvedValue({ count: 1 });
    tx.leaveTransaction.create.mockResolvedValue({ id: 1 });

    await deductLeaveForApproval({
      employeeId: 1,
      leaveType: "CL",
      days: 1,
      leaveRequestId: 55,
      createdBy: "mgr",
      tx: tx as never,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.employeeLeaveBalance.updateMany).toHaveBeenCalled();
  });

  it("Case 6 — processPendingLeaveAccruals(tx) reuses caller transaction", async () => {
    const tx = makeTx();
    const joiningDate = new Date();
    joiningDate.setMonth(joiningDate.getMonth() - 2); // not EL-eligible
    tx.employee.findUnique.mockResolvedValue({
      id: 9,
      joiningDate,
    });

    tx.employeeLeaveBalance.findUnique.mockResolvedValue({
      employeeId: 9,
      elBalance: 0,
      clBalance: 0,
      slBalance: 0,
    });
    // Pretend all system accruals already exist → no creates
    tx.leaveTransaction.findMany.mockResolvedValue([
      { reason: `CL yearly allocation ${new Date().getFullYear()}` },
      { reason: `SL yearly allocation ${new Date().getFullYear()}` },
    ]);

    await processPendingLeaveAccruals(9, tx as never);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.leaveTransaction.findMany).toHaveBeenCalled();
    expect(tx.leaveTransaction.create).not.toHaveBeenCalled();
  });

  it("Case 6 — concurrent system accrual unique maps to Accrual already posted", async () => {
    const tx = makeTx();
    tx.employeeLeaveBalance.findUnique.mockResolvedValue({
      employeeId: 1,
      elBalance: 0,
      clBalance: 0,
      slBalance: 0,
    });
    tx.employeeLeaveBalance.update.mockResolvedValue({});
    tx.leaveTransaction.create.mockRejectedValue({ code: "P2002" });

    await expect(
      recordLeaveTransactionInTx(tx as never, {
        employeeId: 1,
        leaveType: "CL",
        transactionType: "accrual",
        amount: 12,
        reason: "CL yearly allocation 2026",
        createdBy: "system",
      })
    ).rejects.toThrow(/Accrual already posted/);
  });
});
