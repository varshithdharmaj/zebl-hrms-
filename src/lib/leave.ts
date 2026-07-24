import { Prisma } from "@/generated/prisma/client";
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
import { LeaveRequestStatus } from "@/generated/prisma/enums";

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

/** Candidate accrual reason strings for the current calendar year / EL months. */
export function buildPendingAccrualReasons(
  joiningDate: Date,
  year: number = getCalendarYear(),
  asOf: Date = new Date()
): { reason: string; leaveType: LeaveType; amount: number }[] {
  const pending: { reason: string; leaveType: LeaveType; amount: number }[] = [
    {
      reason: `CL yearly allocation ${year}`,
      leaveType: "CL",
      amount: DEFAULT_CL_ANNUAL,
    },
    {
      reason: `SL yearly allocation ${year}`,
      leaveType: "SL",
      amount: DEFAULT_SL_ANNUAL,
    },
  ];

  if (isEligibleForEL(joiningDate, asOf)) {
    for (const monthKey of getElAccrualMonthKeys(joiningDate, asOf)) {
      pending.push({
        reason: `EL monthly accrual ${monthKey}`,
        leaveType: "EL",
        amount: EL_MONTHLY_ACCRUAL,
      });
    }
  }

  return pending;
}

/**
 * Process pending CL/SL yearly and EL monthly accruals.
 * Prefer calling from actions; leave page may still process for balance freshness.
 * Returns joiningDate so callers can avoid a second employee round-trip.
 */
export async function processPendingLeaveAccruals(
  employeeId: number
): Promise<{ joiningDate: Date }> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const joiningDate = employee.joiningDate;
  const pending = buildPendingAccrualReasons(joiningDate);
  const candidateReasons = pending.map((p) => p.reason);

  await prisma.$transaction(async (tx) => {
    // Balance ensure + existence check are independent — one round-trip instead of N.
    const [, existing] = await Promise.all([
      getOrCreateLeaveBalanceRow(employeeId, tx),
      tx.leaveTransaction.findMany({
        where: {
          employeeId,
          reason: { in: candidateReasons },
        },
        select: { reason: true },
      }),
    ]);

    const existingSet = new Set(
      existing.map((row) => row.reason).filter((r): r is string => Boolean(r))
    );

    for (const item of pending) {
      if (existingSet.has(item.reason)) continue;
      await recordLeaveTransactionInTx(tx, {
        employeeId,
        leaveType: item.leaveType,
        transactionType: "accrual",
        amount: item.amount,
        reason: item.reason,
        createdBy: "system",
      });
      existingSet.add(item.reason);
    }
  });

  return { joiningDate };
}

export async function getLeaveBalanceSummaries(
  employeeId: number,
  options?: { processAccruals?: boolean }
): Promise<LeaveBalanceSummary[]> {
  let joiningDate: Date;

  if (options?.processAccruals) {
    // Accrual path already loaded the employee — reuse joiningDate (no second findUnique).
    ({ joiningDate } = await processPendingLeaveAccruals(employeeId));
  } else {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new Error("Employee not found");
    joiningDate = employee.joiningDate;
  }

  // Balance row + transaction aggregates are independent once the employee exists.
  // Accruals (when enabled) already ensured the balance row and employee validity.
  const [balance, aggregations, manualAdjustments] = await Promise.all([
    getOrCreateLeaveBalanceRow(employeeId),
    prisma.leaveTransaction.groupBy({
      by: ["leaveType", "transactionType"],
      where: { employeeId },
      _sum: {
        amount: true,
      },
    }),
    prisma.leaveTransaction.findMany({
      where: {
        employeeId,
        transactionType: "manual_adjustment",
      },
      select: {
        leaveType: true,
        amount: true,
      },
    }),
  ]);

  return buildLeaveBalanceSummariesFromParts(
    joiningDate,
    balance,
    aggregations,
    manualAdjustments
  );
}

/**
 * Pure leave-balance summary math shared by single-employee and batch overview paths.
 * Must stay bit-equivalent for the same inputs.
 */
export function buildLeaveBalanceSummariesFromParts(
  joiningDate: Date,
  balance: { elBalance: number; clBalance: number; slBalance: number },
  aggregations: Array<{
    leaveType: string;
    transactionType: string;
    _sum: { amount: number | null };
  }>,
  manualAdjustments: Array<{ leaveType: string; amount: number }>
): LeaveBalanceSummary[] {
  const elEligible = isEligibleForEL(joiningDate);

  const remainingMap: Record<LeaveType, number> = {
    EL: balance.elBalance,
    CL: balance.clBalance,
    SL: balance.slBalance,
  };

  return LEAVE_TYPES.map((leaveType) => {
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
      const eligibility = getEligibilityDate(joiningDate);
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
}

export type EmployeeForLeaveBalanceBatch = {
  id: number;
  joiningDate: Date;
};

/**
 * Batch leave-balance summaries for many employees (admin overview).
 * Preserves getOrCreateLeaveBalanceRow side effects via createMany(skipDuplicates).
 * Uses processAccruals:false semantics (no accrual processing).
 */
export async function getLeaveBalanceSummariesForEmployees(
  employees: EmployeeForLeaveBalanceBatch[]
): Promise<Map<number, LeaveBalanceSummary[]>> {
  const result = new Map<number, LeaveBalanceSummary[]>();
  if (employees.length === 0) return result;

  const employeeIds = employees.map((e) => e.id);

  // Same side effect as N× getOrCreateLeaveBalanceRow: ensure a balance row exists.
  await prisma.employeeLeaveBalance.createMany({
    data: employeeIds.map((employeeId) => ({ employeeId })),
    skipDuplicates: true,
  });

  const [balances, aggregations, manualAdjustments] = await Promise.all([
    prisma.employeeLeaveBalance.findMany({
      where: { employeeId: { in: employeeIds } },
    }),
    prisma.leaveTransaction.groupBy({
      by: ["employeeId", "leaveType", "transactionType"],
      where: { employeeId: { in: employeeIds } },
      _sum: { amount: true },
    }),
    prisma.leaveTransaction.findMany({
      where: {
        employeeId: { in: employeeIds },
        transactionType: "manual_adjustment",
      },
      select: {
        employeeId: true,
        leaveType: true,
        amount: true,
      },
    }),
  ]);

  const balanceByEmployee = new Map(balances.map((b) => [b.employeeId, b]));

  const aggsByEmployee = new Map<
    number,
    Array<{ leaveType: string; transactionType: string; _sum: { amount: number | null } }>
  >();
  for (const row of aggregations) {
    const list = aggsByEmployee.get(row.employeeId) ?? [];
    list.push({
      leaveType: row.leaveType,
      transactionType: row.transactionType,
      _sum: row._sum,
    });
    aggsByEmployee.set(row.employeeId, list);
  }

  const manualsByEmployee = new Map<
    number,
    Array<{ leaveType: string; amount: number }>
  >();
  for (const row of manualAdjustments) {
    const list = manualsByEmployee.get(row.employeeId) ?? [];
    list.push({ leaveType: row.leaveType, amount: row.amount });
    manualsByEmployee.set(row.employeeId, list);
  }

  for (const emp of employees) {
    const balance = balanceByEmployee.get(emp.id) ?? {
      elBalance: 0,
      clBalance: 0,
      slBalance: 0,
    };
    result.set(
      emp.id,
      buildLeaveBalanceSummariesFromParts(
        emp.joiningDate,
        balance,
        aggsByEmployee.get(emp.id) ?? [],
        manualsByEmployee.get(emp.id) ?? []
      )
    );
  }

  return result;
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
