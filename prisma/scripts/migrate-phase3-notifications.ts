/**
 * Phase 3: notification preferences seed (schema via prisma db push)
 * Run: npm run db:migrate-phase3
 */
import { PrismaClient } from "@prisma/client";
import { tableExists } from "./db-utils";

const prisma = new PrismaClient();

async function main() {
  if (!(await tableExists(prisma, "notifications"))) {
    console.error("[phase3] notifications table missing. Run: npx prisma db push");
    process.exit(1);
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }
  console.log(`[phase3] Ensured notification preferences for ${users.length} user(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
