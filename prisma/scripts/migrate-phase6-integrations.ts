/**
 * Phase 6: integrations seed (schema via prisma db push)
 * Run: npm run db:migrate-phase6
 */
import { PrismaClient } from "@/generated/prisma/client";
import { tableExists } from "./db-utils";

const prisma = new PrismaClient();

async function main() {
  if (!(await tableExists(prisma, "integration_settings"))) {
    console.error("[phase6] integration_settings missing. Run: npx prisma db push");
    process.exit(1);
  }

  await prisma.integrationSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  console.log("[phase6] integration_settings default row ensured.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
