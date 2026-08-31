-- Final leave policy alignment against the actual VEB HR Policy Manual v1.0:
--   * EL eligibility corrected from 14 months (interim rule) to 12 months
--     (completion of one year from DOJ) — both the column default AND the
--     already-seeded settings row are updated so this takes effect immediately.
--   * CL/SL annual entitlement become policy-configurable (previously
--     hardcoded constants in application code — see leave.ts).
--   * New policy knobs: monthly leave limit (LOP trigger), max consecutive
--     leave days, advance notice days, EL encashment cap — represented as
--     settings so business logic can enforce them and the settings UI can
--     expose them, per policy sections 5/6/7/8/9 of the confirmed HR policy.
--   * A new, separate human-readable LeavePolicyDocument table for the
--     in-app "Leave Policy" page — versioned, additive-only, never parsed
--     by business logic.
--
-- NOT included here: broadening leave_transactions_system_accrual_reason_uidx
-- to cover 'expiry' (needed for a DB-enforced SL year-end lapse). Discovered
-- during this migration's preparation: that index — and its sibling
-- leave_transactions_one_per_request_type_idx — do NOT actually exist in
-- production despite migration 20260811140000_leave_transaction_idempotency
-- being marked applied (its first attempt was rolled back due to pre-existing
-- duplicate accrual rows, then a second entry was force-marked "applied" via
-- `prisma migrate resolve` without the SQL ever succeeding). Real duplicate
-- (employee_id, reason) accrual rows exist today for both CL/SL yearly
-- allocations and legacy flat EL monthly accruals. Creating either index now
-- would fail the same way. Fixing this safely requires reconciling the
-- duplicate rows' balance impact first — deliberately out of scope for this
-- migration; the new SL lapse below uses the same app-level idempotency
-- (pre-check + transaction) that CL/SL accrual has always actually relied on
-- in this database, so it is no less safe than existing behavior. See the
-- audit report for the recommended remediation.

-- AlterTable
ALTER TABLE "leave_policy_settings"
  ALTER COLUMN "el_eligibility_months" SET DEFAULT 12,
  ADD COLUMN "el_encashment_cap_days" DOUBLE PRECISION NOT NULL DEFAULT 30,
  ADD COLUMN "cl_annual_entitlement" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN "monthly_leave_limit" DOUBLE PRECISION NOT NULL DEFAULT 2,
  ADD COLUMN "max_consecutive_days" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "advance_notice_days" INTEGER NOT NULL DEFAULT 7;

-- Data fix: the singleton settings row was already seeded with the interim
-- 14-month value by the prior migration. Correct it to the confirmed
-- 12-month (one full year) rule. Only touches el_eligibility_months —
-- no other column is modified by this statement.
UPDATE "leave_policy_settings" SET "el_eligibility_months" = 12 WHERE "id" = 1 AND "el_eligibility_months" = 14;

-- CreateTable
CREATE TABLE "leave_policy_documents" (
    "id" SERIAL NOT NULL,
    "version" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_policy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_policy_documents_is_active_idx" ON "leave_policy_documents"("is_active");
