-- CreateEnum
CREATE TYPE "PayrollHrDecision" AS ENUM ('no_action', 'apply_leave', 'salary_deduction', 'warning', 'approved_exception');

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "payroll_start_day" INTEGER NOT NULL DEFAULT 25,
    "required_work_minutes" INTEGER NOT NULL DEFAULT 480,
    "break_minutes" INTEGER NOT NULL DEFAULT 60,
    "required_office_minutes" INTEGER NOT NULL DEFAULT 540,
    "ot_threshold_minutes" INTEGER NOT NULL DEFAULT 0,
    "half_day_threshold_minutes" INTEGER NOT NULL DEFAULT 240,
    "grace_minutes" INTEGER NOT NULL DEFAULT 15,
    "shift_rules_json" TEXT NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_attendance_summaries" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "payroll_period_start" TIMESTAMP(3) NOT NULL,
    "payroll_period_end" TIMESTAMP(3) NOT NULL,
    "working_days" INTEGER NOT NULL DEFAULT 0,
    "required_minutes" INTEGER NOT NULL DEFAULT 0,
    "actual_minutes" INTEGER NOT NULL DEFAULT 0,
    "shortfall_minutes" INTEGER NOT NULL DEFAULT 0,
    "ot_minutes" INTEGER NOT NULL DEFAULT 0,
    "leave_days" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "absent_days" INTEGER NOT NULL DEFAULT 0,
    "late_count" INTEGER NOT NULL DEFAULT 0,
    "recommended_deduction" TEXT,
    "hr_decision" "PayrollHrDecision" NOT NULL DEFAULT 'no_action',
    "remarks" TEXT,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_attendance_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_attendance_summaries_payroll_period_start_payroll_per_idx" ON "payroll_attendance_summaries"("payroll_period_start", "payroll_period_end");

-- CreateIndex
CREATE INDEX "payroll_attendance_summaries_hr_decision_idx" ON "payroll_attendance_summaries"("hr_decision");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_attendance_summaries_employee_id_payroll_period_start_key" ON "payroll_attendance_summaries"("employee_id", "payroll_period_start", "payroll_period_end");

-- AddForeignKey
ALTER TABLE "payroll_attendance_summaries" ADD CONSTRAINT "payroll_attendance_summaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
