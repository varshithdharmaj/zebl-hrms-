-- Phase 2D Step 1: Raw biometric punch event table for eSSL Attendance Bridge integration.
--
-- Additive-only migration: creates one new table, no existing tables modified.
-- Idempotency key: (source, table_name, device_log_id)
-- employee_id is nullable — unmapped biometric employees are still persisted.

-- CreateTable
CREATE TABLE "biometric_punches" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "device_log_id" INTEGER NOT NULL,
    "employee_code" TEXT NOT NULL,
    "employee_id" INTEGER,
    "punched_at" TIMESTAMP(3) NOT NULL,
    "device_id" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biometric_punches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: idempotency key
CREATE UNIQUE INDEX "biometric_punches_source_table_name_device_log_id_key" ON "biometric_punches"("source", "table_name", "device_log_id");

-- CreateIndex: lookup by employee code
CREATE INDEX "biometric_punches_employee_code_idx" ON "biometric_punches"("employee_code");

-- CreateIndex: lookup by employee id
CREATE INDEX "biometric_punches_employee_id_idx" ON "biometric_punches"("employee_id");

-- CreateIndex: lookup by punch timestamp
CREATE INDEX "biometric_punches_punched_at_idx" ON "biometric_punches"("punched_at");

-- AddForeignKey: nullable employee reference, ON DELETE SET NULL
ALTER TABLE "biometric_punches" ADD CONSTRAINT "biometric_punches_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
