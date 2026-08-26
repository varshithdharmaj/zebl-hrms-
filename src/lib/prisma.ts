import "server-only";

import { PrismaClient } from "@prisma/client";
import { assertDatabaseUrl } from "@/lib/config/database";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  assertDatabaseUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reuse one client per serverless isolate (required on Vercel + Neon).
globalForPrisma.prisma = prisma;
