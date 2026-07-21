import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: pg.Pool };

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "[AMS] DATABASE_URL is not configured. Set it as a Cloudflare secret (wrangler secret put DATABASE_URL) or in .env."
    );
  }

  const pool = new pg.Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.pool = pool;
  }

  return client;
}

// Proxy defers PrismaClient creation to the first property access.
// All call sites continue to use `prisma.user.findUnique(...)` unchanged.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
