import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const hasLeaveType = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA table_info("employee_leave_balances")`
  );

  if (!hasLeaveType.some((c) => c.name === "leave_type")) {
    console.log("Balance table already in new format.");
    return;
  }

  console.log("Consolidating duplicate leave balance rows...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "employee_leave_balances_new" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "employee_id" INTEGER NOT NULL UNIQUE,
      "el_balance" REAL NOT NULL DEFAULT 0,
      "cl_balance" REAL NOT NULL DEFAULT 0,
      "sl_balance" REAL NOT NULL DEFAULT 0,
      "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "employee_leave_balances_new" ("employee_id", "el_balance", "cl_balance", "sl_balance", "updated_at")
    SELECT
      e.id,
      COALESCE((SELECT SUM(balance) FROM "employee_leave_balances" b WHERE b.employee_id = e.id AND b.leave_type = 'EL'), 0),
      COALESCE((SELECT SUM(balance) FROM "employee_leave_balances" b WHERE b.employee_id = e.id AND b.leave_type = 'CL'), 0),
      COALESCE((SELECT SUM(balance) FROM "employee_leave_balances" b WHERE b.employee_id = e.id AND b.leave_type = 'SL'), 0),
      CURRENT_TIMESTAMP
    FROM "employees" e
  `);

  await prisma.$executeRawUnsafe(`DROP TABLE "employee_leave_balances"`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "employee_leave_balances_new" RENAME TO "employee_leave_balances"`
  );

  console.log("Done.");
}

main().finally(() => prisma.$disconnect());
