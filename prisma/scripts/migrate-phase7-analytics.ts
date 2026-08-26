/**
 * Phase 7: analytics tables (schema via prisma db push)
 * Run: npm run db:migrate-phase7
 */
import { PrismaClient } from "@prisma/client";
import { tableExists } from "./db-utils";

const prisma = new PrismaClient();

async function main() {
  for (const table of ["workforce_metrics", "analytics_snapshots", "anomaly_detections"]) {
    if (!(await tableExists(prisma, table))) {
      console.error(`[phase7] ${table} missing. Run: npx prisma db push`);
      process.exit(1);
    }
  }
  console.log("[phase7] Analytics tables verified.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
