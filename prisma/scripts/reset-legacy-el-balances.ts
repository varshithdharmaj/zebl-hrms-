/**
 * One-time data fix: reconciles EmployeeLeaveBalance.elBalance to exactly
 * sum(ElAccrualLot.remaining) for any employee where they differ.
 *
 * Decision (confirmed): "start fresh" — legacy pre-lot-system EL balance is
 * zeroed, not migrated into a lot. For employees with NO lots, this means
 * elBalance -> 0. But some employees have already accrued real lots under
 * the new engine (post-launch) with stale legacy balance layered on top of
 * that (e.g. employee 671: elBalance=46, but lots correctly sum to 15) — for
 * those, the fix reconciles down to the correct lot-backed value (15), not
 * to 0, so genuinely-earned new-system accrual is never discarded.
 *
 * Idempotent: re-running after a successful fix finds no mismatches and
 * does nothing. Each correction is logged as an auditable LeaveTransaction
 * (manual_adjustment) so the balance history isn't silently altered.
 *
 * Usage: npx tsx prisma/scripts/reset-legacy-el-balances.ts [--dry-run]
 */
import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const balances = await prisma.employeeLeaveBalance.findMany({
    where: { elBalance: { not: 0 } },
    select: { employeeId: true, elBalance: true },
  });

  const lots = await prisma.elAccrualLot.groupBy({
    by: ["employeeId"],
    _sum: { remaining: true },
  });
  const lotSumByEmployee = new Map(lots.map((l) => [l.employeeId, l._sum.remaining ?? 0]));

  const mismatched = balances.filter((b) => {
    const lotSum = lotSumByEmployee.get(b.employeeId) ?? 0;
    return Math.abs(lotSum - b.elBalance) > 1e-9;
  });

  console.log(`Found ${mismatched.length} employee(s) with elBalance != sum(lot.remaining).`);
  if (mismatched.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  console.log(mismatched.map((m) => `  employee ${m.employeeId}: elBalance=${m.elBalance}, lotSum=${lotSumByEmployee.get(m.employeeId) ?? 0}`).join("\n"));

  if (DRY_RUN) {
    console.log("\n--dry-run: no changes made.");
    return;
  }

  let fixed = 0;
  for (const { employeeId, elBalance } of mismatched) {
    const correctBalance = lotSumByEmployee.get(employeeId) ?? 0;
    const delta = correctBalance - elBalance; // negative: excess legacy balance being removed

    await prisma.$transaction(async (tx) => {
      const updated = await tx.employeeLeaveBalance.updateMany({
        where: { employeeId, elBalance },
        data: { elBalance: correctBalance },
      });
      if (updated.count === 0) return; // changed concurrently since the read above; skip, safe to re-run

      await tx.leaveTransaction.create({
        data: {
          employeeId,
          leaveType: "EL",
          transactionType: "manual_adjustment",
          amount: delta,
          reason:
            correctBalance === 0
              ? "EL balance reset to zero — legacy pre-lot-system balance with no backing accrual lots (start-fresh migration)"
              : `EL balance reconciled to accrual-lot total (${correctBalance}) — removed ${-delta} of stale legacy pre-lot-system balance (start-fresh migration)`,
          createdBy: "system-migration",
        },
      });
    });
    fixed += 1;
    console.log(`  fixed employee ${employeeId}: ${elBalance} -> ${correctBalance}`);
  }

  console.log(`\nReconciled ${fixed} employee(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
