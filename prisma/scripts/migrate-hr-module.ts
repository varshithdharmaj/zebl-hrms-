/**
 * Safe in-place HR module migration for SQLite.
 * Run: npx tsx prisma/scripts/migrate-hr-module.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA table_info("${table}")`
  );
  return rows.some((r) => r.name === column);
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
  );
  return rows.length > 0;
}

async function main() {
  console.log("Starting HR module migration...");

  if (!(await columnExists("employees", "joining_date"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "employees" ADD COLUMN "phone" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "employees" ADD COLUMN "designation" TEXT`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "employees" ADD COLUMN "joining_date" DATETIME`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "employees" ADD COLUMN "employee_status" TEXT NOT NULL DEFAULT 'Active'`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "employees" SET "joining_date" = "created_at" WHERE "joining_date" IS NULL`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "employees" SET "employee_status" = CASE WHEN "is_active" = 1 THEN 'Active' ELSE 'Inactive' END`
    );
    console.log("Added employee profile columns.");
  }

  const oldBalanceShape = await columnExists("employee_leave_balances", "leave_type");

  if (oldBalanceShape) {
    console.log("Migrating employee_leave_balances to single-row model...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "employee_leave_balances_new" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "employee_id" INTEGER NOT NULL,
        "el_balance" REAL NOT NULL DEFAULT 0,
        "cl_balance" REAL NOT NULL DEFAULT 0,
        "sl_balance" REAL NOT NULL DEFAULT 0,
        "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "employee_leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      INSERT OR IGNORE INTO "employee_leave_balances_new" ("employee_id", "el_balance", "cl_balance", "sl_balance", "updated_at")
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
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "employee_leave_balances_employee_id_key" ON "employee_leave_balances"("employee_id")`
    );
    console.log("Migrated leave balances.");
  }

  const oldTxHasYear = await columnExists("leave_transactions", "year");

  if (oldTxHasYear) {
    console.log("Migrating leave_transactions...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "leave_transactions_new" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "employee_id" INTEGER NOT NULL,
        "leave_type" TEXT NOT NULL,
        "transaction_type" TEXT NOT NULL,
        "amount" REAL NOT NULL,
        "reason" TEXT,
        "created_by" TEXT,
        "leave_request_id" INTEGER,
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "leave_transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "leave_transactions_new" ("employee_id", "leave_type", "transaction_type", "amount", "reason", "created_by", "leave_request_id", "created_at")
      SELECT
        "employee_id",
        "leave_type",
        CASE
          WHEN "transaction_type" = 'usage' THEN 'deduction'
          WHEN "transaction_type" = 'adjustment' AND "amount" < 0 THEN 'deduction'
          WHEN "transaction_type" IN ('yearly_allocation', 'adjustment', 'accrual') THEN 'accrual'
          ELSE 'accrual'
        END,
        ABS("amount"),
        COALESCE("note", 'Migrated'),
        "created_by",
        "leave_request_id",
        "created_at"
      FROM "leave_transactions"
    `);

    await prisma.$executeRawUnsafe(`DROP TABLE "leave_transactions"`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "leave_transactions_new" RENAME TO "leave_transactions"`);
    console.log("Migrated leave transactions.");
  }

  if (!(await tableExists("employee_leave_balances"))) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "employee_leave_balances" (
        "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        "employee_id" INTEGER NOT NULL,
        "el_balance" REAL NOT NULL DEFAULT 0,
        "cl_balance" REAL NOT NULL DEFAULT 0,
        "sl_balance" REAL NOT NULL DEFAULT 0,
        "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "employee_leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "employee_leave_balances_employee_id_key" ON "employee_leave_balances"("employee_id")`
    );
  }

  console.log("Migration complete. Run: npx prisma generate && npm run db:seed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
