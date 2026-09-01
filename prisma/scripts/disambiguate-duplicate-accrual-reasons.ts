/**
 * Enables the (employee_id, reason) unique index by disambiguating the
 * `reason` string on every duplicate row EXCEPT the oldest (canonical) one
 * per (employeeId, reason, transactionType in accrual/expiry, leaveRequestId
 * null) group. Nothing is deleted; amount/type/employeeId/createdAt/id are
 * untouched — only `reason` gets a "(duplicate — voided ...)" suffix so the
 * row remains fully visible in history but no longer collides with the key.
 *
 * Balance correctness for CL/SL was already fixed separately via
 * reconcile-duplicate-cl-sl-accruals.ts (compensating manual_adjustment
 * transactions) — this script never touches amount or balance, only reason.
 *
 * Usage: npx tsx prisma/scripts/disambiguate-duplicate-accrual-reasons.ts [--dry-run]
 */
import { PrismaClient } from "@/generated/prisma/client";
const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

type Row = { id: number; employeeId: number; reason: string | null; createdAt: Date };

async function main() {
  const rows = await prisma.leaveTransaction.findMany({
    where: {
      leaveRequestId: null,
      reason: { not: null },
      transactionType: { in: ["accrual", "expiry"] },
    },
    select: { id: true, employeeId: true, reason: true, createdAt: true },
    orderBy: [{ employeeId: "asc" }, { createdAt: "asc" }],
  });

  const groups = new Map<string, Row[]>();
  for (const row of rows as Row[]) {
    const key = `${row.employeeId}::${row.reason}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const dupeGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
  console.log(`Found ${dupeGroups.length} duplicate groups.`);

  let renamed = 0;
  for (const [key, list] of dupeGroups) {
    const [, reason] = key.split("::");
    const [canonical, ...extras] = list; // oldest first (orderBy createdAt asc)
    console.log(`Group "${key}": keeping id=${canonical.id} canonical, renaming ${extras.length} extra row(s).`);

    for (const extra of extras) {
      const newReason = `${reason} (duplicate — voided, see idempotency audit; original id ${extra.id})`;
      if (DRY_RUN) {
        console.log(`  --dry-run: would rename id=${extra.id} reason -> "${newReason}"`);
        continue;
      }
      await prisma.leaveTransaction.update({
        where: { id: extra.id },
        data: { reason: newReason },
      });
      renamed++;
    }
  }

  console.log(`\n${DRY_RUN ? "Would rename" : "Renamed"} ${DRY_RUN ? dupeGroups.reduce((s, [, l]) => s + l.length - 1, 0) : renamed} row(s) total.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
