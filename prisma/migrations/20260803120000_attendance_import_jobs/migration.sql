-- Idempotent: safe if partially applied or ensured at runtime first.

DO $$ BEGIN
  CREATE TYPE "AttendanceImportJobStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'FAILED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "attendance_import_jobs" (
    "id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "status" "AttendanceImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
    "file_name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "report_type" TEXT,
    "form_attendance_date" TIMESTAMP(3),
    "total_rows" INTEGER NOT NULL,
    "next_row_index" INTEGER NOT NULL DEFAULT 0,
    "imported_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "employees_created" INTEGER NOT NULL DEFAULT 0,
    "users_created" INTEGER NOT NULL DEFAULT 0,
    "warnings_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "payload_compressed" BYTEA NOT NULL,
    "parser_version" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_import_jobs_created_by_user_id_status_created_at_idx"
ON "attendance_import_jobs"("created_by_user_id", "status", "created_at");
