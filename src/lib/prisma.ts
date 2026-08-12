import "server-only";

import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { resolveDatabasePoolMax, usesPgBouncer } from "@/lib/prisma-pool";

type PrismaGlobal = {
  prisma?: PrismaClient;
  pgPool?: Pool;
  prismaShutdownRegistered?: boolean;
};

const globalForPrisma = globalThis as typeof globalThis & PrismaGlobal;

function createPgPool(url: string): Pool {
  const max = resolveDatabasePoolMax();
  const pgbouncer = usesPgBouncer(url);
  return new Pool({
    connectionString: url,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(pgbouncer ? { maxUses: 1 } : {}),
  });
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "[AMS] DATABASE_URL is not configured. Set it as a Cloudflare secret (wrangler secret put DATABASE_URL) or in .env."
    );
  }

  const pool = globalForPrisma.pgPool ?? createPgPool(url);
  globalForPrisma.pgPool = pool;

  const adapter = new PrismaPg(pool, {
    onPoolError: (err) => {
      console.error("[prisma] pool error", err.message);
    },
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });
}

function registerShutdown(client: PrismaClient): void {
  if (globalForPrisma.prismaShutdownRegistered) return;
  if (typeof process === "undefined" || typeof process.once !== "function") return;
  globalForPrisma.prismaShutdownRegistered = true;

  const shutdown = () => {
    void client.$disconnect().catch(() => undefined);
    void globalForPrisma.pgPool?.end().catch(() => undefined);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
registerShutdown(prisma);

/**
 * Same instance as {@link prisma}. Tests must not call `$disconnect()` —
 * this client is process-wide and shared across parallel files.
 */
export function getPrismaClient(): PrismaClient {
  return prisma;
}
