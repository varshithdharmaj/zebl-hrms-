import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import {
  DEFAULT_CL_ANNUAL,
  DEFAULT_SL_ANNUAL,
  EL_MONTHLY_ACCRUAL,
  type LeaveType,
  LEAVE_TYPES,
  leaveTypeToBalanceField,
  type LeaveTransactionType,
} from "@/lib/leave-types";
import { startOfDay } from "@/lib/utils";
import { LeaveRequestStatus } from "@prisma/client";

export type LeaveBalanceSummary = {
  leaveType: LeaveType;
  remaining: number;
  used: number;
  total: number;
  eligible: boolean;
  note?: string;
};

type TxClient = Prisma.TransactionClient;

export function getCalendarYear(date: Date = new Date()): number {
  return date.getFullYear();
}

export function countLeaveDays(startDate: Date, endDate: Date): number {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function getEligibilityDate(joiningDate: Date): Date {
  const d = new Date(joiningDate);
  d.setFullYear(d.getFullYear() + 1);
  return startOfDay(d);
}

export function isEligibleForEL(joiningDate: Date, asOf: Date = new Date()): boolean {
  return startOfDay(asOf) >= getEligibilityDate(joiningDate);
}

export function getElAccrualMonthKeys(joiningDate: Date, asOf: Date = new Date()): string[] {
  const eligibility = getEligibilityDate(joiningDate);
  if (startOfDay(asOf) < eligibility) return [];

  const keys: string[] = [];
  let cursor = new Date(eligibility.getFullYear(), eligibility.getMonth(), 1);
  const end = new Date(asOf.getFullYear(), asOf.getMonth(), 1);

  while (cursor <= end) {
    keys.push(formatMonthKey(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return keys;
}

function formatMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function getOrCreateLeaveBalanceRow(employeeId: number, tx?: TxClient) {
  const client = tx ?? prisma;
  const existing = await client.employeeLeaveBalance.findUnique({
    where: { employeeId },
  });
  if (existing) return existing;

  try {
    return await client.employeeLeaveBalance.create({
      data: { employeeId },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return client.employeeLeaveBalance.findUniqueOrThrow({
        where: { employeeId },
      });
    }
    throw error;
  }
}

function applyBalanceDelta(
  balances: { elBalance: number; clBalance: number; slBalance: number },
  leaveType: LeaveType,
  transactionType: LeaveTransactionType,
  amount: number
): { elBalance: number; clBalance: number; slBalance: number } {
  const field = leaveTypeToBalanceField(leaveType);
  let delta = 0;

  if (transactionType === "accrual") {
    delta = Math.abs(amount);
  } else if (transactionType === "deduction") {
    delta = -Math.abs(amount);
  } else {
    delta = amount;
  }

  return {
    ...balances,
    [field]: balances[field] + delta,
  };
}

export async function recordLeaveTransactionInTx(
  tx: TxClient,
  params: {
    employeeId: number;
    leaveType: LeaveType;
    transactionType: LeaveTransactionType;
    amount: number;
    reason?: string;
    createdBy?: string;
    leaveRequestId?: number;
  }
): Promise<void> {
  const { employeeId, leaveType, transactionType, amount, reason, createdBy, leaveRequestId } =
    params;

  if (amount === 0 && transactionType !== "manual_adjustment") {
    throw new Error("Transaction amount must be non-zero.");
  }

  await tx.leaveTransaction.create({
    data: {
      employeeId,
      leaveType,
      transactionType,
      amount:
        transactionType === "manual_adjustment" ? amount : Math.abs(amount),
      reason: reason ?? null,
      createdBy: createdBy ?? null,
      leaveRequestId: leaveRequestId ?? null,
    },
  });

  const current = await getOrCreateLeaveBalanceRow(employeeId, tx);
  const updated = applyBalanceDelta(
    {
      elBalance: current.elBalance,
      clBalance: current.clBalance,
      slBalance: current.slBalance,
    },
    leaveType,
    transactionType,
    amount
  );

  await tx.employeeLeaveBalance.update({
    where: { employeeId },
    data: updated,
  });
}

export async function recordLeaveTransaction(params: {
  employeeId: number;
  leaveType: LeaveType;
  transactionType: LeaveTransactionType;
  amount: number;
  reason?: string;
  createdBy?: string;
  leaveRequestId?: number;
}) {
  return prisma.$transaction(async (tx) => {
    await recordLeaveTransactionInTx(tx, params);
  });
}

async function hasAccrualReason(
  employeeId: number,
  reason: string,
  tx?: TxClient
): Promise<boolean> {
  const client = tx ?? prisma;
  const existing = await client.leaveTransaction.findFirst({
    where: { employeeId, reason },
  });
  return !!existing;
}

/** Process pending CL/SL yearly and EL monthly accruals — call from actions, not page renders */
export async function processPendingLeaveAccruals(employeeId: number): Promise<void> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const year = getCalendarYear();
  const joiningDate = employee.joiningDate;

  await prisma.$transaction(async (tx) => {
    await getOrCreateLeaveBalanceRow(employeeId, tx);

    const clReason = `CL yearly allocation ${year}`;
    if (!(await hasAccrualReason(employeeId, clReason, tx))) {
      await recordLeaveTransactionInTx(tx, {
        employeeId,
        leaveType: "CL",
        transactionType: "accrual",
        amount: DEFAULT_CL_ANNUAL,
        reason: clReason,
        createdBy: "system",
      });
    }

    const slReason = `SL yearly allocation ${year}`;
    if (!(await hasAccrualReason(employeeId, slReason, tx))) {
      await recordLeaveTransactionInTx(tx, {
        employeeId,
        leaveType: "SL",
        transactionType: "accrual",
        amount: DEFAULT_SL_ANNUAL,
        reason: slReason,
        createdBy: "system",
      });
    }

    if (!isEligibleForEL(joiningDate)) return;

    const monthKeys = getElAccrualMonthKeys(joiningDate);
    for (const monthKey of monthKeys) {
      const reason = `EL monthly accrual ${monthKey}`;
      if (await hasAccrualReason(employeeId, reason, tx)) continue;

      await recordLeaveTransactionInTx(tx, {
        employeeId,
        leaveType: "EL",
        transactionType: "accrual",
        amount: EL_MONTHLY_ACCRUAL,
        reason,
        createdBy: "system",
      });
    }
  });
}

export async function getLeaveBalanceSummaries(
  employeeId: number,
  options?: { processAccruals?: boolean }
): Promise<LeaveBalanceSummary[]> {
  if (options?.processAccruals) {
    await processPendingLeaveAccruals(employeeId);
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const balance = await getOrCreateLeaveBalanceRow(employeeId);
  const elEligible = isEligibleForEL(employee.joiningDate);

  const remainingMap: Record<LeaveType, number> = {
    EL: balance.elBalance,
    CL: balance.clBalance,
    SL: balance.slBalance,
  };

  const aggregations = await prisma.leaveTransaction.groupBy({
    by: ["leaveType", "transactionType"],
    where: { employeeId },
    _sum: {
      amount: true,
    },
  });

  const manualAdjustments = await prisma.leaveTransaction.findMany({
    where: {
      employeeId,
      transactionType: "manual_adjustment",
    },
    select: {
      leaveType: true,
      amount: true,
    },
  });

  const summaries = LEAVE_TYPES.map((leaveType) => {
    let used = 0;
    let accrued = 0;

    const typeAggs = aggregations.filter((a) => a.leaveType === leaveType);
    for (const group of typeAggs) {
      const sum = group._sum.amount ?? 0;
      if (group.transactionType === "deduction") {
        used += sum;
      } else if (group.transactionType === "accrual") {
        accrued += sum;
      }
    }

    const typeManuals = manualAdjustments.filter((m) => m.leaveType === leaveType);
    for (const tx of typeManuals) {
      if (tx.amount < 0) {
        used += Math.abs(tx.amount);
      } else if (tx.amount > 0) {
        accrued += tx.amount;
      }
    }

    const remaining = remainingMap[leaveType];
    const total = remaining + used;

    let note: string | undefined;
    if (leaveType === "EL" && !elEligible) {
      const eligibility = getEligibilityDate(employee.joiningDate);
      note = `Eligible from ${eligibility.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`;
    }

    return {
      leaveType,
      remaining,
      used,
      total: total > 0 ? total : accrued,
      eligible: leaveType !== "EL" || elEligible,
      note,
    };
  });

  return summaries;
}

export async function getRemainingBalance(
  employeeId: number,
  leaveType: LeaveType
): Promise<number> {
  const balance = await getOrCreateLeaveBalanceRow(employeeId);
  return balance[leaveTypeToBalanceField(leaveType)];
}

export async function deductLeaveForApproval(params: {
  employeeId: number;
  leaveType: LeaveType;
  days: number;
  leaveRequestId: number;
  createdBy: string;
  tx?: TxClient;
}) {
  const { employeeId, leaveType, days, leaveRequestId, createdBy, tx } = params;

  const run = async (client: TxClient) => {
    const balance = await getOrCreateLeaveBalanceRow(employeeId, client);
    const field = leaveTypeToBalanceField(leaveType);
    const available = balance[field];
    if (available < days) {
      throw new Error(
        `Insufficient ${leaveType} balance. Available: ${available}, required: ${days}`
      );
    }

    await recordLeaveTransactionInTx(client, {
      employeeId,
      leaveType,
      transactionType: "deduction",
      amount: days,
      reason: `Leave request #${leaveRequestId} approved`,
      createdBy,
      leaveRequestId,
    });
  };

  if (tx) {
    await run(tx);
  } else {
    await processPendingLeaveAccruals(employeeId);
    await prisma.$transaction(run);
  }
}

export async function restoreLeaveBalanceForCancellation(params: {
  employeeId: number;
  leaveType: LeaveType;
  days: number;
  leaveRequestId: number;
  createdBy: string;
  reason: string;
  tx?: TxClient;
}) {
  const { employeeId, leaveType, days, leaveRequestId, createdBy, reason, tx } = params;

  const run = async (client: TxClient) => {
    await recordLeaveTransactionInTx(client, {
      employeeId,
      leaveType,
      transactionType: "accrual",
      amount: days,
      reason: `Cancellation of leave #${leaveRequestId}: ${reason}`,
      createdBy,
      leaveRequestId,
    });
  };

  if (tx) {
    await run(tx);
  } else {
    await prisma.$transaction(run);
  }
}

export async function adminAdjustLeaveBalance(params: {
  employeeId: number;
  leaveType: LeaveType;
  adjustment: number;
  reason: string;
  createdBy: string;
}) {
  const { employeeId, leaveType, adjustment, reason, createdBy } = params;

  if (adjustment === 0) {
    throw new Error("Adjustment amount cannot be zero.");
  }

  await getOrCreateLeaveBalanceRow(employeeId);

  await recordLeaveTransaction({
    employeeId,
    leaveType,
    transactionType: "manual_adjustment",
    amount: adjustment,
    reason,
    createdBy,
  });
}

export async function initializeEmployeeLeaveBalances(
  employeeId: number,
  initial?: { el?: number; cl?: number; sl?: number },
  createdBy = "system"
) {
  await getOrCreateLeaveBalanceRow(employeeId);
  await processPendingLeaveAccruals(employeeId);

  const entries: { type: LeaveType; amount: number }[] = [];
  if (initial?.el && initial.el > 0) entries.push({ type: "EL", amount: initial.el });
  if (initial?.cl && initial.cl > 0) entries.push({ type: "CL", amount: initial.cl });
  if (initial?.sl && initial.sl > 0) entries.push({ type: "SL", amount: initial.sl });

  for (const { type, amount } of entries) {
    await recordLeaveTransaction({
      employeeId,
      leaveType: type,
      transactionType: "manual_adjustment",
      amount,
      reason: "Initial balance on employee creation",
      createdBy,
    });
  }
}

export async function getLeaveTransactionHistory(employeeId: number, limit = 100) {
  const [transactions, requests] = await Promise.all([
    prisma.leaveTransaction.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  type HistoryRow = {
    id: string;
    date: Date;
    leaveType: string;
    transactionType: string;
    amount: number;
    reason: string;
    updatedBy: string;
  };

  const rows: HistoryRow[] = transactions.map((tx) => ({
    id: `tx-${tx.id}`,
    date: tx.createdAt,
    leaveType: tx.leaveType,
    transactionType: tx.transactionType,
    amount:
      tx.transactionType === "deduction"
        ? -tx.amount
        : tx.transactionType === "manual_adjustment"
          ? tx.amount
          : tx.amount,
    reason: tx.reason ?? "—",
    updatedBy: tx.createdBy ?? "system",
  }));

  for (const req of requests) {
    if (req.status === LeaveRequestStatus.approved) {
      rows.push({
        id: `req-${req.id}`,
        date: req.reviewedAt ?? req.createdAt,
        leaveType: req.leaveType,
        transactionType: "leave_approval",
        amount: -req.days,
        reason: req.reason,
        updatedBy: req.reviewedBy ?? "HR",
      });
    }
  }

  rows.sort((a, b) => b.date.getTime() - a.date.getTime());
  return rows.slice(0, limit);
}
