import { PrismaClient } from "@/generated/prisma/client";
import { seedJohnDoeMonth } from "../seed-john-doe";

const prisma = new PrismaClient();

seedJohnDoeMonth(prisma)
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
