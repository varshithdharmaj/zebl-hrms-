import "server-only";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { cache } from "react";

const getClient = cache((): PrismaClient => {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "[AMS] DATABASE_URL is not configured. Set it as a Cloudflare secret (wrangler secret put DATABASE_URL) or in .env."
    );
  }

  const adapter = new PrismaPg({
    connectionString: url,
    maxUses: 1,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });
});

// Proxy defers PrismaClient creation to the first property access.
// All call sites continue to use `prisma.user.findUnique(...)` unchanged.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});
