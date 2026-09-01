-- Actually applies the leave-transaction idempotency indexes that migration
-- 20260811140000_leave_transaction_idempotency was supposed to create.
--
-- That migration's first attempt was rolled back (2026-08-17) because
-- duplicate accrual rows already existed at the time; a second entry was
-- then force-marked "applied" via `prisma migrate resolve --applied`
-- without the SQL ever actually succeeding. Confirmed via `pg_indexes`:
-- neither index existed in production before this migration.
--
-- Pre-requisite (completed out-of-band before this migration, see
-- prisma/scripts/reconcile-duplicate-cl-sl-accruals.ts): the only duplicate
-- rows that violated the (employee_id, reason) key — employees 423 and 671's
-- doubled CL/SL 2026 yearly allocations — had their balance impact
-- corrected via compensating manual_adjustment transactions. The duplicate
-- rows themselves were NOT deleted (preserved for audit); only the
-- duplicate BALANCE effect was reversed, so the balance is correct while
-- history is intact. Employee 20's duplicate had no balance effect (already
-- correct). Legacy EL "monthly accrual" duplicates (employee 671, pre-lot
-- system) are superseded/inert — EL balance is driven entirely by
-- ElAccrualLot post-reconciliation, not this ledger — so they do not
-- violate this index today (there are no NEW rows with the same reason
-- expected in the future for a dead code path) and were left untouched.
--
-- (leave_request_id, transaction_type) had zero pre-existing violations —
-- verified before writing this migration — so it needed no reconciliation.

CREATE UNIQUE INDEX IF NOT EXISTS "leave_transactions_one_per_request_type_idx"
  ON "leave_transactions" ("leave_request_id", "transaction_type")
  WHERE "leave_request_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leave_transactions_system_accrual_reason_uidx"
  ON "leave_transactions" ("employee_id", "reason")
  WHERE "transaction_type" IN ('accrual', 'expiry')
    AND "leave_request_id" IS NULL
    AND "reason" IS NOT NULL;
