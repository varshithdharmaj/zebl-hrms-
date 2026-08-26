/**
 * Phase 5: Microsoft SSO (schema via prisma db push)
 * Run: npm run db:migrate-phase5
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$queryRaw`SELECT azure_oid FROM users LIMIT 0`;
  console.log("[phase5] Microsoft SSO user columns verified.");
}

main()
  .catch((e) => {
    console.error("[phase5] Run npx prisma db push first.", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
