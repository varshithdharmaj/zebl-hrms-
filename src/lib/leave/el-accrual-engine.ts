import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import { getOrCreateLeaveBalanceRow } from "@/lib/leave/balance-row";
import { getCycleKey, getElAccrualDatesUpTo, getElExpiryDate } from "@/lib/leave/el-dates";
import { getLeavePolicySettings, type LeavePolicy } from "@/lib/leave/leave-policy";

type TxClient = Prisma.TransactionClient;

export type ElAccrualResult = {
  employeeId: number;
  lotsCreated: string[]; // cycleKeys
};

/**
 * Posts any EL accrual lots the employee is due but doesn't yet have, up to `asOf`.
 * Idempotent via the (employeeId, cycleKey) unique index on el_accrual_lots — a
 * duplicate create is caught and treated as already-posted, never as an error.
 * Runs each missing cycle inside its own DB transaction so a failure on one
 * cycle/employee never rolls back another.
 */
export async function runElAccrualForEmployee(
  employee: { id: number; joiningDate: Date; isActive: boolean },
  policy: LeavePolicy,
  asOf: Date = new Date()
): Promise<ElAccrualResult> {
  const result: ElAccrualResult = { employeeId: employee.id, lotsCreated: [] };
  if (!employee.isActive) return result;

  const dueDates = getElAccrualDatesUpTo(employee.joiningDate, policy, asOf);
  if (dueDates.length === 0) return result;

  const cycleKeys = dueDates.map(getCycleKey);
  const existing = await prisma.elAccrualLot.findMany({
    where: { employeeId: employee.id, cycleKey: { in: cycleKeys } },
    select: { cycleKey: true },
  });
  const existingSet = new Set(existing.map((r) => r.cycleKey));

  for (const accrualDate of dueDates) {
    const cycleKey = getCycleKey(accrualDate);
    if (existingSet.has(cycleKey)) continue;

    try {
      await prisma.$transaction(async (tx) => {
        await postAccrualLot(tx, employee.id, cycleKey, accrualDate, policy);
      });
      result.lotsCreated.push(cycleKey);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // Concurrent run already posted this cycle — not a failure.
        continue;
      }
      throw error;
    }
  }

  return result;
}

async function postAccrualLot(
  tx: TxClient,
  employeeId: number,
  cycleKey: string,
  accrualDate: Date,
  policy: LeavePolicy
): Promise<void> {
  await getOrCreateLeaveBalanceRow(employeeId, tx);

  const lot = await tx.elAccrualLot.create({
    data: {
      employeeId,
      cycleKey,
      accrualDate,
      amount: policy.elAccrualAmount,
      remaining: policy.elAccrualAmount,
      expiryDate: getElExpiryDate(accrualDate, policy),
    },
  });

  await tx.leaveTransaction.create({
    data: {
      employeeId,
      leaveType: "EL",
      transactionType: "accrual",
      amount: policy.elAccrualAmount,
      reason: `EL accrual ${cycleKey}`,
      createdBy: "system",
      elAccrualLotId: lot.id,
    },
  });

  await tx.employeeLeaveBalance.update({
    where: { employeeId },
    data: { elBalance: { increment: policy.elAccrualAmount } },
  });
}

/**
 * Same as runElAccrualForEmployee, but runs inside an already-open transaction
 * instead of opening its own per-cycle transactions. Use this from callers
 * that already hold a `tx` (e.g. leave-approval finalization) — nesting a
 * separate prisma.$transaction there risks lock contention/deadlock against
 * the outer one. Duplicate-cycle races are still caught (unique constraint)
 * and treated as already-posted, not as a hard failure.
 */
export async function runElAccrualForEmployeeInTx(
  tx: TxClient,
  employee: { id: number; joiningDate: Date; isActive: boolean },
  policy: LeavePolicy,
  asOf: Date = new Date()
): Promise<ElAccrualResult> {
  const result: ElAccrualResult = { employeeId: employee.id, lotsCreated: [] };
  if (!employee.isActive) return result;

  const dueDates = getElAccrualDatesUpTo(employee.joiningDate, policy, asOf);
  if (dueDates.length === 0) return result;

  const cycleKeys = dueDates.map(getCycleKey);
  const existing = await tx.elAccrualLot.findMany({
    where: { employeeId: employee.id, cycleKey: { in: cycleKeys } },
    select: { cycleKey: true },
  });
  const existingSet = new Set(existing.map((r) => r.cycleKey));

  for (const accrualDate of dueDates) {
    const cycleKey = getCycleKey(accrualDate);
    if (existingSet.has(cycleKey)) continue;

    try {
      await postAccrualLot(tx, employee.id, cycleKey, accrualDate, policy);
      result.lotsCreated.push(cycleKey);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
  }

  return result;
}

/** Convenience wrapper for callers that only have an employeeId (e.g. lazy on-read accrual). */
export async function runElAccrualForEmployeeId(
  employeeId: number,
  asOf: Date = new Date()
): Promise<ElAccrualResult> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, joiningDate: true, isActive: true },
  });
  if (!employee) throw new Error("Employee not found");

  const policy = await getLeavePolicySettings();
  return runElAccrualForEmployee(employee, policy, asOf);
}

/** Runs EL accrual for every active employee. Per-employee failures are logged, not fatal. */
export async function runElAccrualBatch(
  asOf: Date = new Date()
): Promise<{ processed: number; lotsCreated: number; failures: number }> {
  const policy = await getLeavePolicySettings();
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, joiningDate: true, isActive: true },
  });

  let lotsCreated = 0;
  let failures = 0;

  for (const employee of employees) {
    try {
      const result = await runElAccrualForEmployee(employee, policy, asOf);
      lotsCreated += result.lotsCreated.length;
    } catch (error) {
      failures += 1;
      console.error(`[leave] EL accrual failed for employee ${employee.id}:`, error);
    }
  }

  return { processed: employees.length, lotsCreated, failures };
}
