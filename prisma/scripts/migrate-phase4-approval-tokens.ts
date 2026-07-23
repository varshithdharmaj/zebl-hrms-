/**
 * Phase 4: approval tokens (schema via prisma db push)
 * Run: npm run db:migrate-phase4
 */
import { PrismaClient } from "@/generated/prisma/client";
import { tableExists } from "./db-utils";

const prisma = new PrismaClient();

async function main() {
  if (!(await tableExists(prisma, "approval_tokens"))) {
    console.error("[phase4] approval_tokens table missing. Run: npx prisma db push");
    process.exit(1);
  }
  console.log("[phase4] approval_tokens schema verified.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
