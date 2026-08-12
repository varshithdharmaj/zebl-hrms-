-- Leave approval concurrency / ledger idempotency (P0-2)
--
-- Migration risk: CREATE UNIQUE INDEX fails if duplicate rows already exist.
-- Inspect before deploy:
--   SELECT leave_request_id, transaction_type, COUNT(*)
--   FROM leave_transactions
--   WHERE leave_request_id IS NOT NULL
--   GROUP BY 1, 2 HAVING COUNT(*) > 1;
--
--   SELECT employee_id, reason, COUNT(*)
--   FROM leave_transactions
--   WHERE transaction_type = 'accrual' AND leave_request_id IS NULL AND reason IS NOT NULL
--   GROUP BY 1, 2 HAVING COUNT(*) > 1;
--
-- Do NOT auto-delete duplicates in this migration.

-- At most one ledger row per (leave request, transaction type) when linked to a request.
-- Covers: one approval deduction + one cancellation restore accrual per request.
CREATE UNIQUE INDEX IF NOT EXISTS "leave_transactions_one_per_request_type_idx"
  ON "leave_transactions" ("leave_request_id", "transaction_type")
  WHERE "leave_request_id" IS NOT NULL;

-- Idempotent system accruals (yearly CL/SL, monthly EL) keyed by reason string.
CREATE UNIQUE INDEX IF NOT EXISTS "leave_transactions_system_accrual_reason_uidx"
  ON "leave_transactions" ("employee_id", "reason")
  WHERE "transaction_type" = 'accrual'
    AND "leave_request_id" IS NULL
    AND "reason" IS NOT NULL;
