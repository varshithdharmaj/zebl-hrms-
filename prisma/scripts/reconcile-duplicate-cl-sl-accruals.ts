/**
 * One-time reconciliation: corrects CL/SL balances inflated by duplicate
 * "yearly allocation" accrual transactions (root cause: the DB unique index
 * meant to prevent this was never actually applied in production — see
 * audit). Never deletes or edits the original duplicate ledger rows —
 * writes a compensating `manual_adjustment` transaction instead, using the
 * same mechanism HR balance corrections already use.
 *
 * Hardcoded to the exact three employees identified by the audit
 * (20 — no correction needed, balance already correct; 423; 671) rather
 * than a generic "find and fix everything" scan, so this can't accidentally
 * touch an employee the audit didn't examine.
 *
 * Usage: npx tsx prisma/scripts/reconcile-duplicate-cl-sl-accruals.ts [--dry-run]
 */
import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const CORRECTIONS: { employeeId: number; leaveType: "CL" | "SL"; delta: number; from: number; to: number }[] = [
  { employeeId: 423, leaveType: "CL", delta: -12, from: 24, to: 12 },
  { employeeId: 423, leaveType: "SL", delta: -12, from: 24, to: 12 },
  { employeeId: 671, leaveType: "CL", delta: -12, from: 22, to: 10 },
  { employeeId: 671, leaveType: "SL", delta: -12, from: 24, to: 12 },
];

const REASON =
  "Correcting duplicate CL/SL yearly allocation 2026 — accrual was applied twice due to a missing DB uniqueness constraint (see leave-transaction-idempotency audit)";

async function main() {
  for (const c of CORRECTIONS) {
    const field = c.leaveType === "CL" ? "clBalance" : "slBalance";
    const current = await prisma.employeeLeaveBalance.findUnique({ where: { employeeId: c.employeeId } });
    const currentValue = current?.[field] ?? 0;

    console.log(
      `Employee ${c.employeeId} ${c.leaveType}: expected current=${c.from}, actual current=${currentValue}, correction=${c.delta}, expected result=${c.to}`
    );

    if (currentValue !== c.from) {
      console.log(`  SKIPPING — actual current balance (${currentValue}) doesn't match the audited value (${c.from}); state changed since the audit, needs re-review.`);
      continue;
    }

    if (DRY_RUN) {
      console.log("  --dry-run: no changes made.");
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.employeeLeaveBalance.updateMany({
        where: { employeeId: c.employeeId, [field]: c.from },
        data: { [field]: c.to },
      });
      if (updated.count === 0) {
        throw new Error(`Employee ${c.employeeId} ${c.leaveType} balance changed concurrently — aborting this correction.`);
      }

      await tx.leaveTransaction.create({
        data: {
          employeeId: c.employeeId,
          leaveType: c.leaveType,
          transactionType: "manual_adjustment",
          amount: c.delta,
          reason: REASON,
          createdBy: "system-migration",
        },
      });
    });

    console.log(`  Applied: ${c.leaveType} ${c.from} -> ${c.to} for employee ${c.employeeId}.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
