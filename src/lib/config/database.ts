import { getEnv, isPostgresDatabase } from "@/lib/config/env";
import {
  formatDbConnectionHelp,
  isDbUnreachableError,
  parsePostgresHost,
} from "@/lib/db/connection-error";

export type DatabaseUrlValidation = {
  ok: boolean;
  message?: string;
  hint?: string;
};

export function validateDatabaseUrl(): DatabaseUrlValidation {
  const url = getEnv("DATABASE_URL");

  if (!url) {
    return {
      ok: false,
      message: "DATABASE_URL is not set.",
      hint: "Copy .env.example to .env and set a postgresql:// connection string.",
    };
  }

  if (url.startsWith("file:") || url.includes("sqlite")) {
    return {
      ok: false,
      message: `DATABASE_URL uses SQLite (${url.slice(0, 40)}…). AMS requires PostgreSQL.`,
      hint: 'Update .env to: DATABASE_URL="postgresql://zebl:zebl_dev_password@localhost:5432/zebl_ams" then run: npm run db:postgres:up && npm run db:setup',
    };
  }

  if (!isPostgresDatabase()) {
    return {
      ok: false,
      message: "DATABASE_URL must start with postgresql:// or postgres://.",
      hint: "See .env.example for local Docker, Neon, Supabase, or Railway formats.",
    };
  }

  return { ok: true };
}

export function assertDatabaseUrl(): void {
  const result = validateDatabaseUrl();
  if (!result.ok) {
    const parts = [result.message, result.hint].filter(Boolean);
    throw new Error(`[AMS Database] ${parts.join(" ")}`);
  }
}

/** Optional connectivity probe at startup (Node runtime only). */
export async function probeDatabaseConnection(): Promise<{
  ok: boolean;
  message?: string;
  hint?: string;
}> {
  assertDatabaseUrl();
  const { prisma } = await import("@/lib/prisma");
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (e) {
    const url = getEnv("DATABASE_URL") ?? "";
    const { host, port } = parsePostgresHost(url);
    const short = isDbUnreachableError(e)
      ? `Cannot reach PostgreSQL at ${host}:${port}. Run: npm run db:ping`
      : e instanceof Error
        ? e.message
        : String(e);
    return {
      ok: false,
      message: short,
      hint: formatDbConnectionHelp(url),
    };
  }
}
