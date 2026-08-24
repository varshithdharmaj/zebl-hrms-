import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";

type TxClient = Prisma.TransactionClient;

/**
 * Extracted from leave.ts so el-accrual-engine.ts (and other EL-lot modules)
 * can depend on it without creating a leave.ts <-> el-accrual-engine.ts
 * import cycle. leave.ts re-exports this for backward compatibility.
 */
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
