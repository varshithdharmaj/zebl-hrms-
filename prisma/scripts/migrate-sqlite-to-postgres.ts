/**
 * SQLite → PostgreSQL migration helper.
 *
 * Recommended approach:
 * 1. docker compose up -d
 * 2. Set DATABASE_URL=postgresql://zebl:zebl_dev_password@localhost:5432/zebl_ams
 * 3. npx prisma db push
 * 4. npm run db:migrate-phase3 … phase7 (idempotent)
 * 5. npm run db:seed
 * 6. Export SQLite data with sqlite3 .dump or custom ETL, then import into Postgres
 *
 * This script validates Postgres connectivity and schema readiness.
 */
import { PrismaClient } from "@/generated/prisma/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    console.error(
      "[migrate-sqlite-to-postgres] DATABASE_URL must be a PostgreSQL connection string."
    );
    console.error("Example: postgresql://zebl:zebl_dev_password@localhost:5432/zebl_ams");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    console.log(`[migrate-sqlite-to-postgres] Connected. ${tables.length} public tables.`);
    const required = ["users", "leave_requests", "notifications", "audit_logs", "worker_heartbeats"];
    const names = new Set(tables.map((t) => t.tablename));
    for (const t of required) {
      if (!names.has(t)) {
        console.warn(`[migrate-sqlite-to-postgres] Missing table: ${t} — run npx prisma db push`);
      }
    }
    console.log("[migrate-sqlite-to-postgres] Postgres schema check complete.");
    console.log(
      "For data: export from SQLite (attendance_manager.db) and import via pg_restore or custom seed."
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
