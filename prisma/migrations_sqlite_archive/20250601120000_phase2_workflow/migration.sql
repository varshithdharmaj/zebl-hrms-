-- Phase 2: Leave workflow engine

CREATE TABLE "leave_approval_steps" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leave_request_id" INTEGER NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_id" INTEGER,
    "approver_role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "acted_at" DATETIME,
    "acted_by_user_id" TEXT,
    "comment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "leave_approval_steps_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leave_approval_steps_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "leave_approval_steps_leave_request_id_step_order_key" ON "leave_approval_steps"("leave_request_id", "step_order");
CREATE INDEX "leave_approval_steps_approver_id_status_idx" ON "leave_approval_steps"("approver_id", "status");
CREATE INDEX "leave_approval_steps_leave_request_id_idx" ON "leave_approval_steps"("leave_request_id");

ALTER TABLE "leave_requests" ADD COLUMN "workflow_status" TEXT NOT NULL DEFAULT 'pending_approval';
ALTER TABLE "leave_requests" ADD COLUMN "submitted_at" DATETIME;
ALTER TABLE "leave_requests" ADD COLUMN "current_step_id" INTEGER;
ALTER TABLE "leave_requests" ADD COLUMN "rejection_reason" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN "cancelled_at" DATETIME;
ALTER TABLE "leave_requests" ADD COLUMN "withdrawn_at" DATETIME;
ALTER TABLE "leave_requests" ADD COLUMN "final_approved_at" DATETIME;
ALTER TABLE "leave_requests" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "leave_requests" ADD COLUMN "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "leave_requests_current_step_id_key" ON "leave_requests"("current_step_id");
CREATE INDEX "leave_requests_employee_id_workflow_status_idx" ON "leave_requests"("employee_id", "workflow_status");

UPDATE "leave_requests" SET "submitted_at" = "created_at" WHERE "submitted_at" IS NULL;
UPDATE "leave_requests" SET "workflow_status" = 'approved', "final_approved_at" = COALESCE("reviewed_at", "created_at") WHERE "status" = 'approved';
UPDATE "leave_requests" SET "workflow_status" = 'rejected' WHERE "status" = 'rejected';
