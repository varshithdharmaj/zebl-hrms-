import { existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@/generated/prisma/client";
import { isPostgresDatabase } from "../../src/lib/config/env";

const root = join(__dirname, "..", "..");

const requiredPhaseScripts = [
  "migrate-phase3-notifications.ts",
  "migrate-phase4-approval-tokens.ts",
  "migrate-phase5-microsoft-sso.ts",
  "migrate-phase6-integrations.ts",
  "migrate-phase7-analytics.ts",
];

const requiredModels = [
  "approvalToken",
  "notification",
  "integrationSettings",
  "workforceMetric",
  "workerHeartbeat",
] as const;

function fail(message: string): never {
  console.error(`[db:validate] ${message}`);
  process.exit(1);
}

async function main() {
  const migrationsDir = join(root, "prisma", "migrations");
  if (!existsSync(migrationsDir)) {
    fail("prisma/migrations directory is missing.");
  }

  for (const script of requiredPhaseScripts) {
    const path = join(root, "prisma", "scripts", script);
    if (!existsSync(path)) {
      fail(`Missing phase script: prisma/scripts/${script}`);
    }
  }

  if (!isPostgresDatabase()) {
    fail("DATABASE_URL must be postgresql:// (SQLite is not supported).");
  }

  const prisma = new PrismaClient();
  try {
    for (const model of requiredModels) {
      if (!(model in prisma)) {
        fail(`Prisma client missing model delegate: ${model}`);
      }
    }

    await prisma.$queryRaw`SELECT 1`;
    console.log("[db:validate] Database connection OK.");
  } catch (e) {
    fail(`Database not reachable or schema incomplete: ${String(e)}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log("[db:validate] Migration artifacts and schema checks passed.");
}

main();
