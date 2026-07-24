-- AttendanceSession: multi check-in / check-out periods per daily AttendanceRecord

CREATE TABLE IF NOT EXISTS "attendance_sessions" (
    "id" SERIAL NOT NULL,
    "attendance_id" INTEGER NOT NULL,
    "check_in" TEXT NOT NULL,
    "check_out" TEXT,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_sessions_attendance_id_idx"
  ON "attendance_sessions"("attendance_id");

CREATE INDEX IF NOT EXISTS "attendance_sessions_attendance_id_check_out_idx"
  ON "attendance_sessions"("attendance_id", "check_out");

-- At most one open (in-progress) session per daily attendance record
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_one_open_per_day_idx"
  ON "attendance_sessions"("attendance_id")
  WHERE "check_out" IS NULL;

ALTER TABLE "attendance_sessions"
  ADD CONSTRAINT "attendance_sessions_attendance_id_fkey"
  FOREIGN KEY ("attendance_id") REFERENCES "attendance_records"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one completed session from legacy daily checkIn/checkOut when present
INSERT INTO "attendance_sessions" (
  "attendance_id",
  "check_in",
  "check_out",
  "worked_minutes",
  "created_at",
  "updated_at"
)
SELECT
  ar."id",
  ar."check_in",
  ar."check_out",
  COALESCE(ar."worked_minutes", 0),
  COALESCE(ar."created_at", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "attendance_records" ar
WHERE ar."check_in" IS NOT NULL
  AND TRIM(ar."check_in") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "attendance_sessions" s WHERE s."attendance_id" = ar."id"
  );
