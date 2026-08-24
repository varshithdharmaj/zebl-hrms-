import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import {
  DEFAULT_CL_ANNUAL,
  DEFAULT_SL_ANNUAL,
  type LeaveType,
  LEAVE_TYPES,
  leaveTypeToBalanceField,
  type LeaveTransactionType,
} from "@/lib/leave-types";
import { startOfDay } from "@/lib/utils";
import { LeaveRequestStatus } from "@/generated/prisma/enums";
import { getElEligibilityDate } from "@/lib/leave/el-dates";
import { getLeavePolicySettings } from "@/lib/leave/leave-policy";
import { getOrCreateLeaveBalanceRow } from "@/lib/leave/balance-row";
import { runElAccrualForEmployee } from "@/lib/leave/el-accrual-engine";

export { getOrCreateLeaveBalanceRow } from "@/lib/leave/balance-row";

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

/**
 * EL eligibility per the configurable Leave Settings (DOJ + elEligibilityMonths).
 * Async (reads policy from DB) — callers needing a pure/sync summary builder
 * (buildLeaveBalanceSummariesFromParts) must resolve this first and pass the
 * result in, rather than calling this from inside that pure function.
 */
export async function getElEligibilityInfo(
  joiningDate: Date,
  asOf: Date = new Date()
): Promise<{ eligible: boolean; eligibilityDate: Date }> {
  const policy = await getLeavePolicySettings();
  const eligibilityDate = getElEligibilityDate(joiningDate, policy);
  return { eligible: startOfDay(asOf) >= eligibilityDate, eligibilityDate };
}

async function applyBalanceDeltaAtomic(
  tx: TxClient,
  employeeId: number,
  leaveType: LeaveType,
  transactionType: LeaveTransactionType,
  amount: number
): Promise<void> {
  await getOrCreateLeaveBalanceRow(employeeId, tx);
  const field = leaveTypeToBalanceField(leaveType);

  if (transactionType === "deduction") {
    const abs = Math.abs(amount);
    const result = await tx.employeeLeaveBalance.updateMany({
      where: { employeeId, [field]: { gte: abs } },
      data: { [field]: { decrement: abs } },
    });
    if (result.count === 0) {
      throw new Error(
        `Insufficient ${leaveType} balance. Available balance is less than required: ${abs}`
      );
    }
    return;
  }

  if (transactionType === "accrual") {
    await tx.employeeLeaveBalance.update({
      where: { employeeId },
      data: { [field]: { increment: Math.abs(amount) } },
    });
    return;
  }

  // manual_adjustment: signed delta (may go negative — existing business rule)
  await tx.employeeLeaveBalance.update({
    where: { employeeId },
    data: { [field]: { increment: amount } },
  });
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

  // Balance first, then ledger row — unique(request, type) rejects duplicate deductions
  // and rolls the balance change back with the surrounding transaction.
  await applyBalanceDeltaAtomic(tx, employeeId, leaveType, transactionType, amount);

  try {
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
  } catch (error) {
    if (isUniqueConstraintError(error) && leaveRequestId != null) {
      throw new Error(
        transactionType === "deduction"
          ? `Leave request #${leaveRequestId} was already deducted.`
          : `Leave request #${leaveRequestId} already has a ${transactionType} ledger entry.`
      );
    }
    if (isUniqueConstraintError(error) && transactionType === "accrual" && reason) {
      throw new Error(`Accrual already posted: ${reason}`);
    }
    throw error;
  }
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

/**
 * Candidate CL/SL yearly accrual reason strings for the given calendar year.
 * EL is no longer part of this flat-accrual path — EL accrual is lot-based
 * (see el-accrual-engine.ts) with its own 26th/14-month/36-month rules.
 */
export function buildPendingAccrualReasons(
  year: number = getCalendarYear()
): { reason: string; leaveType: LeaveType; amount: number }[] {
  return [
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
}

/**
 * Process pending CL/SL yearly accruals only. EL accrual is handled
 * separately by runElAccrualForEmployee (lot-based, policy-driven) — callers
 * that need both should call that alongside this, not instead of it.
 * Prefer calling from actions; leave page may still process for balance freshness.
 * Returns joiningDate/isActive so callers can avoid a second employee round-trip
 * (e.g. to also trigger EL lot accrual without re-fetching the employee).
 *
 * When `tx` is provided, accruals run inside that transaction (no nested $transaction).
 * Concurrent inserts of the same reason are rejected by the system-accrual unique index.
 */
export async function processPendingLeaveAccruals(
  employeeId: number,
  tx?: TxClient
): Promise<{ joiningDate: Date; isActive: boolean }> {
  const client = tx ?? prisma;
  const employee = await client.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const joiningDate = employee.joiningDate;
  const isActive = employee.isActive;
  const pending = buildPendingAccrualReasons();
  const candidateReasons = pending.map((p) => p.reason);

  const run = async (inner: TxClient) => {
    // Balance ensure + existence check are independent — one round-trip instead of N.
    const [, existing] = await Promise.all([
      getOrCreateLeaveBalanceRow(employeeId, inner),
      inner.leaveTransaction.findMany({
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
      try {
        await recordLeaveTransactionInTx(inner, {
          employeeId,
          leaveType: item.leaveType,
          transactionType: "accrual",
          amount: item.amount,
          reason: item.reason,
          createdBy: "system",
        });
        existingSet.add(item.reason);
      } catch (error) {
        // Concurrent accrual of the same reason — treat as already posted.
        if (
          error instanceof Error &&
          error.message.startsWith("Accrual already posted:")
        ) {
          existingSet.add(item.reason);
          continue;
        }
        throw error;
      }
    }
  };

  if (tx) {
    await run(tx);
  } else {
    await prisma.$transaction(run);
  }

  return { joiningDate, isActive };
}

export async function getLeaveBalanceSummaries(
  employeeId: number,
  options?: { processAccruals?: boolean }
): Promise<LeaveBalanceSummary[]> {
  let joiningDate: Date;

  if (options?.processAccruals) {
    // Accrual path already loaded the employee — reuse joiningDate (no second findUnique).
    const employeeInfo = await processPendingLeaveAccruals(employeeId);
    joiningDate = employeeInfo.joiningDate;

    // EL is lot-based and not covered by processPendingLeaveAccruals above —
    // trigger it here too so balance reads stay fresh between cron runs,
    // reusing employeeInfo instead of a second employee.findUnique.
    const policy = await getLeavePolicySettings();
    await runElAccrualForEmployee(
      { id: employeeId, joiningDate: employeeInfo.joiningDate, isActive: employeeInfo.isActive },
      policy
    );
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

  const elEligibility = await getElEligibilityInfo(joiningDate);

  return buildLeaveBalanceSummariesFromParts(
    elEligibility,
    balance,
    aggregations,
    manualAdjustments
  );
}

/**
 * Pure leave-balance summary math shared by single-employee and batch overview paths.
 * Must stay bit-equivalent for the same inputs. EL eligibility is resolved by the
 * caller (it depends on the DB-backed Leave Settings policy) and passed in so this
 * function itself stays synchronous and side-effect free.
 */
export function buildLeaveBalanceSummariesFromParts(
  elEligibility: { eligible: boolean; eligibilityDate: Date },
  balance: { elBalance: number; clBalance: number; slBalance: number },
  aggregations: Array<{
    leaveType: string;
    transactionType: string;
    _sum: { amount: number | null };
  }>,
  manualAdjustments: Array<{ leaveType: string; amount: number }>
): LeaveBalanceSummary[] {
  const { eligible: elEligible, eligibilityDate } = elEligibility;

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
      } else if (group.transactionType === "expiry") {
        // Expired-unused EL still counts against "total" for display purposes,
        // bucketed alongside "used" (it's no longer available, even though it
        // wasn't literally consumed by a leave request).
        used += sum;
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
      note = `Eligible from ${eligibilityDate.toLocaleDateString("en-IN", {
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
  const policy = await getLeavePolicySettings();

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
    const eligibilityDate = getElEligibilityDate(emp.joiningDate, policy);
    result.set(
      emp.id,
      buildLeaveBalanceSummariesFromParts(
        { eligible: startOfDay(new Date()) >= eligibilityDate, eligibilityDate },
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
    // Conditional decrement + unique(leave_request_id, deduction) enforce
    // insufficient-balance failure and at-most-one deduction per request.
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
    await prisma.$transaction(async (client) => {
      await processPendingLeaveAccruals(employeeId, client);
      await run(client);
    });
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
  if (leaveType === "EL") {
    throw new Error(
      "Use adminAdjustElBalance (el-fifo.ts) for Earned Leave — EL is lot-based and a flat balance edit would desync it from its accrual lots."
    );
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

/**
 * Seeds optional initial CL/SL balances on employee creation. EL is deliberately
 * excluded — an initial EL balance must be seeded as a lot (see
 * seedInitialElLot in el-fifo.ts) so it participates in FIFO/expiry correctly.
 */
export async function initializeEmployeeLeaveBalances(
  employeeId: number,
  initial?: { cl?: number; sl?: number },
  createdBy = "system"
) {
  await getOrCreateLeaveBalanceRow(employeeId);
  await processPendingLeaveAccruals(employeeId);

  const entries: { type: LeaveType; amount: number }[] = [];
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
