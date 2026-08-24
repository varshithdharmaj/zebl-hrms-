-- Attendance Regularisation: employee-submitted, HR-reviewed correction to a
-- day's derived attendance. Raw BiometricPunch rows are never touched by this
-- feature; approved corrections are applied as an overlay on top of the
-- existing punch-derivation pipeline (see deriveAttendanceForEmployeeDate).

-- CreateEnum
CREATE TYPE "RegularizationRequestType" AS ENUM (
  'missing_check_in',
  'missing_check_out',
  'missing_both',
  'incorrect_check_in',
  'incorrect_check_out',
  'attendance_missing',
  'device_failure'
);

-- CreateEnum
CREATE TYPE "RegularizationStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- AlterEnum: notification types for the regularisation lifecycle
ALTER TYPE "NotificationType" ADD VALUE 'attendance_regularization_submitted';
ALTER TYPE "NotificationType" ADD VALUE 'attendance_regularization_approved';
ALTER TYPE "NotificationType" ADD VALUE 'attendance_regularization_rejected';

-- AlterTable: payroll_settings gains the regularisation eligibility window (days)
ALTER TABLE "payroll_settings" ADD COLUMN "regularization_window_days" INTEGER NOT NULL DEFAULT 7;

-- AlterTable: attendance_records gains updatedAt (was missing) and the pointer
-- to the currently-applied approved regularisation for that day. No `source`
-- column: activeRegularizationId IS NOT NULL is the "corrected" signal, so no
-- backfill of historical rows is required.
ALTER TABLE "attendance_records" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "attendance_records" ADD COLUMN "active_regularization_id" INTEGER;

-- CreateTable
CREATE TABLE "attendance_regularization_requests" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "attendance_date" TIMESTAMP(3) NOT NULL,
    "request_type" "RegularizationRequestType" NOT NULL,
    "requested_check_in" TEXT,
    "requested_check_out" TEXT,
    "check_out_next_day" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "status" "RegularizationStatus" NOT NULL DEFAULT 'pending',
    "version" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_comment" TEXT,
    "applied_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "previous_request_id" INTEGER,
    "snapshot_before" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_regularization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_regularization_requests_previous_request_id_key" ON "attendance_regularization_requests"("previous_request_id");

-- CreateIndex
CREATE INDEX "attendance_regularization_requests_employee_id_attendance_idx" ON "attendance_regularization_requests"("employee_id", "attendance_date");

-- CreateIndex
CREATE INDEX "attendance_regularization_requests_status_idx" ON "attendance_regularization_requests"("status");

-- CreateIndex
CREATE INDEX "attendance_regularization_requests_employee_id_status_idx" ON "attendance_regularization_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "attendance_regularization_requests_attendance_date_status_idx" ON "attendance_regularization_requests"("attendance_date", "status");

-- CreateIndex: DB-enforced duplicate-request prevention. Only one PENDING
-- request may exist per employee/day; rejected/cancelled/approved rows never
-- block a resubmission. Guards the race, not just an application check.
CREATE UNIQUE INDEX "attendance_regularization_requests_pending_unique"
  ON "attendance_regularization_requests" ("employee_id", "attendance_date")
  WHERE "status" = 'pending';

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_active_regularization_id_key" ON "attendance_records"("active_regularization_id");

-- AddForeignKey
ALTER TABLE "attendance_regularization_requests" ADD CONSTRAINT "attendance_regularization_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_regularization_requests" ADD CONSTRAINT "attendance_regularization_requests_previous_request_id_fkey" FOREIGN KEY ("previous_request_id") REFERENCES "attendance_regularization_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_active_regularization_id_fkey" FOREIGN KEY ("active_regularization_id") REFERENCES "attendance_regularization_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
