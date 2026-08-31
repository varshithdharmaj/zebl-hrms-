/**
 * Ongoing invariant check: EmployeeLeaveBalance.elBalance must equal
 * SUM(ElAccrualLot.remaining) for every employee. Read-only; reports
 * mismatches, does not fix them (use reset-legacy-el-balances.ts for that).
 *
 * Usage: npx tsx prisma/scripts/check-el-invariant.ts
 */
import { PrismaClient } from "@/generated/prisma/client";
const prisma = new PrismaClient();

async function main() {
  const [balances, lots] = await Promise.all([
    prisma.employeeLeaveBalance.findMany({ select: { employeeId: true, elBalance: true } }),
    prisma.elAccrualLot.groupBy({ by: ["employeeId"], _sum: { remaining: true } }),
  ]);
  const lotSumByEmployee = new Map(lots.map((l) => [l.employeeId, l._sum.remaining ?? 0]));

  const mismatches = balances
    .map((b) => ({
      employeeId: b.employeeId,
      cachedBalance: b.elBalance,
      lotBalance: lotSumByEmployee.get(b.employeeId) ?? 0,
    }))
    .filter((r) => Math.abs(r.cachedBalance - r.lotBalance) > 1e-9)
    .map((r) => ({ ...r, difference: r.cachedBalance - r.lotBalance }));

  console.log(`Checked ${balances.length} employees.`);
  console.log(`Mismatches: ${mismatches.length}`);
  if (mismatches.length > 0) {
    console.log(mismatches);
  }
}

main().finally(() => prisma.$disconnect());
