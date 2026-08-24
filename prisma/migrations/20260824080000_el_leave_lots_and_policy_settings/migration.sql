-- Startup Earned Leave policy: 26th-anchored cycle, DOJ+14mo eligibility,
-- 0.5/month accrual, 36-month per-lot expiry, FIFO consumption.
--
-- Additive only: no existing table/column is dropped or renamed. The legacy
-- flat `employee_leave_balances.el_balance` column is kept (CL/SL still use
-- it); EL now also lives in the new `el_accrual_lots` table as individually
-- expiring lots. Reset of legacy EL balances to zero (decided: "start fresh")
-- is a data-only follow-up script, not part of this DDL migration — see
-- scripts/reset-el-balances-for-lot-migration.ts.

-- CreateTable
CREATE TABLE "leave_policy_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cycle_start_day" INTEGER NOT NULL DEFAULT 26,
    "el_accrual_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "el_eligibility_months" INTEGER NOT NULL DEFAULT 14,
    "el_expiry_months" INTEGER NOT NULL DEFAULT 36,
    "sl_annual_entitlement" INTEGER NOT NULL DEFAULT 6,
    "sl_carry_forward" BOOLEAN NOT NULL DEFAULT false,
    "sl_expiry_months" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "leave_policy_settings_pkey" PRIMARY KEY ("id")
);

-- Seed the single settings row with the policy defaults.
INSERT INTO "leave_policy_settings"
  ("id", "cycle_start_day", "el_accrual_amount", "el_eligibility_months", "el_expiry_months",
   "sl_annual_entitlement", "sl_carry_forward", "sl_expiry_months", "updated_at", "updated_by")
VALUES
  (1, 26, 0.5, 14, 36, 6, false, NULL, CURRENT_TIMESTAMP, 'system')
ON CONFLICT ("id") DO NOTHING;

-- CreateTable
CREATE TABLE "el_accrual_lots" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "cycle_key" TEXT NOT NULL,
    "accrual_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "remaining" DOUBLE PRECISION NOT NULL,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "el_accrual_lots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: idempotency guard for the monthly accrual job — running it
-- twice for the same employee/cycle is a no-op (second insert violates this).
CREATE UNIQUE INDEX "el_accrual_lots_employee_id_cycle_key_key" ON "el_accrual_lots"("employee_id", "cycle_key");

-- CreateIndex
CREATE INDEX "el_accrual_lots_employee_id_expiry_date_idx" ON "el_accrual_lots"("employee_id", "expiry_date");

-- CreateIndex
CREATE INDEX "el_accrual_lots_employee_id_accrual_date_idx" ON "el_accrual_lots"("employee_id", "accrual_date");

-- AddForeignKey
ALTER TABLE "el_accrual_lots" ADD CONSTRAINT "el_accrual_lots_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "leave_consumptions" (
    "id" SERIAL NOT NULL,
    "leave_request_id" INTEGER NOT NULL,
    "el_accrual_lot_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_consumptions_leave_request_id_idx" ON "leave_consumptions"("leave_request_id");

-- CreateIndex
CREATE INDEX "leave_consumptions_el_accrual_lot_id_idx" ON "leave_consumptions"("el_accrual_lot_id");

-- AddForeignKey
ALTER TABLE "leave_consumptions" ADD CONSTRAINT "leave_consumptions_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_consumptions" ADD CONSTRAINT "leave_consumptions_el_accrual_lot_id_fkey" FOREIGN KEY ("el_accrual_lot_id") REFERENCES "el_accrual_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: leave_transactions gains an optional pointer to the EL lot it
-- relates to (accrual/expiry/deduction against a specific lot). Nullable —
-- CL/SL transactions and pre-existing rows never populate this.
ALTER TABLE "leave_transactions" ADD COLUMN "el_accrual_lot_id" INTEGER;

-- CreateIndex
CREATE INDEX "leave_transactions_el_accrual_lot_id_idx" ON "leave_transactions"("el_accrual_lot_id");

-- AddForeignKey
ALTER TABLE "leave_transactions" ADD CONSTRAINT "leave_transactions_el_accrual_lot_id_fkey" FOREIGN KEY ("el_accrual_lot_id") REFERENCES "el_accrual_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
