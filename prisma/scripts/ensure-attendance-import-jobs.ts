/**
 * Apply attendance_import_jobs schema via the Supabase pooler when DIRECT_URL:5432 is unreachable.
 * Run: npx tsx prisma/scripts/ensure-attendance-import-jobs.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "../../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

function loadEnvFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: url, maxUses: 1 });
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'attendance_import_jobs'
    ) AS "exists"
  `;

  if (rows[0]?.exists) {
    console.log("[AMS] attendance_import_jobs already exists — nothing to do.");
    return;
  }

  console.log("[AMS] Creating AttendanceImportJobStatus + attendance_import_jobs…");

  await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  CREATE TYPE "AttendanceImportJobStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'FAILED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`);

  await prisma.$executeRawUnsafe(`
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
`);

  await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS "attendance_import_jobs_created_by_user_id_status_created_at_idx"
ON "attendance_import_jobs"("created_by_user_id", "status", "created_at");
`);

  console.log("[AMS] Schema applied on Supabase.");
}

main()
  .catch((error: unknown) => {
    console.error("[AMS] Failed to ensure schema:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
