/**
 * In-place SQLite migration for Phase 0 foundation.
 * Run: npm run db:migrate-phase0
 */
import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA table_info("${table}")`
  );
  return rows.some((r) => r.name === column);
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    table
  );
  return rows.length > 0;
}

async function runSql(sql: string) {
  await prisma.$executeRawUnsafe(sql);
}

async function main() {
  if (!(await columnExists("employees", "manager_id"))) {
    await runSql(
      `ALTER TABLE "employees" ADD COLUMN "manager_id" INTEGER REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    );
    console.log("Added employees.manager_id");
  }

  if (!(await columnExists("users", "auth_provider"))) {
    await runSql(`ALTER TABLE "users" ADD COLUMN "auth_provider" TEXT NOT NULL DEFAULT 'local'`);
    console.log("Added users.auth_provider");
  }

  if (!(await columnExists("users", "azure_oid"))) {
    await runSql(`ALTER TABLE "users" ADD COLUMN "azure_oid" TEXT`);
    console.log("Added users.azure_oid");
  }

  if (!(await columnExists("users", "session_version"))) {
    await runSql(`ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 1`);
    console.log("Added users.session_version");
  }

  if (!(await tableExists("audit_logs"))) {
    await runSql(`
      CREATE TABLE "audit_logs" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "entity_type" TEXT NOT NULL,
        "entity_id" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "actor_user_id" TEXT,
        "actor_email" TEXT,
        "metadata" TEXT NOT NULL DEFAULT '{}',
        "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await runSql(
      `CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id")`
    );
    await runSql(`CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id")`);
    await runSql(`CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at")`);
    console.log("Created audit_logs table");
  }

  console.log("Phase 0 foundation migration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
