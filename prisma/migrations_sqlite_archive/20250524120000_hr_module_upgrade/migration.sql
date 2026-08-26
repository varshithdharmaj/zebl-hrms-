-- HR Module Upgrade Migration
-- Run via: npx prisma migrate deploy  OR  npx prisma db push

-- Employee profile fields
ALTER TABLE "employees" ADD COLUMN "phone" TEXT;
ALTER TABLE "employees" ADD COLUMN "designation" TEXT;
ALTER TABLE "employees" ADD COLUMN "joining_date" DATETIME;
ALTER TABLE "employees" ADD COLUMN "employee_status" TEXT NOT NULL DEFAULT 'Active';

-- Backfill joining_date from created_at for existing rows
UPDATE "employees" SET "joining_date" = "created_at" WHERE "joining_date" IS NULL;

-- Sync is_active with employee_status
UPDATE "employees" SET "employee_status" = CASE WHEN "is_active" = 1 THEN 'Active' ELSE 'Inactive' END
WHERE "employee_status" IS NULL OR "employee_status" = '';

-- Recreate employee_leave_balances (simplified single-row model)
CREATE TABLE "employee_leave_balances_new" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employee_id" INTEGER NOT NULL,
    "el_balance" REAL NOT NULL DEFAULT 0,
    "cl_balance" REAL NOT NULL DEFAULT 0,
    "sl_balance" REAL NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "employee_leave_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate aggregated balances from old per-type rows if old table exists
INSERT INTO "employee_leave_balances_new" ("employee_id", "el_balance", "cl_balance", "sl_balance", "updated_at")
SELECT
    e.id,
    COALESCE((SELECT SUM(balance) FROM "employee_leave_balances" b WHERE b.employee_id = e.id AND b.leave_type = 'EL'), 0),
    COALESCE((SELECT SUM(balance) FROM "employee_leave_balances" b WHERE b.employee_id = e.id AND b.leave_type = 'CL'), 0),
    COALESCE((SELECT SUM(balance) FROM "employee_leave_balances" b WHERE b.employee_id = e.id AND b.leave_type = 'SL'), 0),
    CURRENT_TIMESTAMP
FROM "employees" e
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='employee_leave_balances');

DROP TABLE IF EXISTS "employee_leave_balances";
ALTER TABLE "employee_leave_balances_new" RENAME TO "employee_leave_balances";
CREATE UNIQUE INDEX "employee_leave_balances_employee_id_key" ON "employee_leave_balances"("employee_id");

-- Update leave_transactions schema
CREATE TABLE "leave_transactions_new" (
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
);

INSERT INTO "leave_transactions_new" ("employee_id", "leave_type", "transaction_type", "amount", "reason", "created_by", "leave_request_id", "created_at")
SELECT
    "employee_id",
    "leave_type",
    CASE
        WHEN "transaction_type" IN ('usage') THEN 'deduction'
        WHEN "transaction_type" IN ('adjustment', 'yearly_allocation') THEN
            CASE WHEN "amount" < 0 THEN 'deduction' ELSE 'accrual' END
        ELSE COALESCE("transaction_type", 'accrual')
    END,
    ABS("amount"),
    COALESCE("note", 'Migrated transaction'),
    "created_by",
    "leave_request_id",
    "created_at"
FROM "leave_transactions"
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='leave_transactions');

DROP TABLE IF EXISTS "leave_transactions";
ALTER TABLE "leave_transactions_new" RENAME TO "leave_transactions";
CREATE INDEX "leave_transactions_employee_id_leave_type_idx" ON "leave_transactions"("employee_id", "leave_type");
