-- Attendance scheduling: weekly working-day defaults + date-specific overrides.
-- Purely additive — creates two new tables and one new enum. Does not alter,
-- backfill, or delete any existing table or row (AttendanceRecord, Holiday,
-- LeaveRequest, PayrollSettings are all untouched).

-- 1. Override-type enum.
CREATE TYPE "AttendanceOverrideType" AS ENUM ('working_day', 'weekly_off');

-- 2. Singleton attendance scheduling settings (mirrors the PayrollSettings /
--    IntegrationSettings singleton-row convention: id = 'default').
CREATE TABLE "attendance_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "monday_working" BOOLEAN NOT NULL DEFAULT true,
    "tuesday_working" BOOLEAN NOT NULL DEFAULT true,
    "wednesday_working" BOOLEAN NOT NULL DEFAULT true,
    "thursday_working" BOOLEAN NOT NULL DEFAULT true,
    "friday_working" BOOLEAN NOT NULL DEFAULT true,
    "saturday_working" BOOLEAN NOT NULL DEFAULT false,
    "sunday_working" BOOLEAN NOT NULL DEFAULT false,
    "expected_work_minutes" INTEGER NOT NULL DEFAULT 480,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id")
);

-- 3. Date-specific schedule overrides (e.g. "this Saturday is a working day").
CREATE TABLE "attendance_date_overrides" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "AttendanceOverrideType" NOT NULL,
    "reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_date_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_date_overrides_date_key" ON "attendance_date_overrides"("date");
CREATE INDEX "attendance_date_overrides_date_idx" ON "attendance_date_overrides"("date");
