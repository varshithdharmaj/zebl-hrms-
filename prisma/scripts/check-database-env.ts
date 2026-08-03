/**
 * Validates DATABASE_URL before dev/build. Run: npm run db:check-env
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

// Runtime secrets (Cloudflare dashboard) are not injected into `npm run build`.
// Skip when explicitly opted out, or when Cloudflare CI is building the Worker.
const isCloudflareBuild =
  process.env.CF_PAGES === "1" ||
  process.env.CLOUDFLARE_BUILD === "1" ||
  Boolean(process.env.CF_PAGES_COMMIT_SHA?.trim()) ||
  Boolean(process.env.WORKERS_CI?.trim());

if (
  process.env.ZEBL_SKIP_DB_STARTUP?.trim() === "true" ||
  isCloudflareBuild
) {
  const reason = isCloudflareBuild
    ? "Cloudflare CI build (runtime secrets are not available here)"
    : "ZEBL_SKIP_DB_STARTUP=true";
  console.log(`[AMS] Skipping database env check — ${reason}`);
  process.exit(0);
}

const url = process.env.DATABASE_URL?.trim() ?? "";

function fail(message: string, hint?: string): never {
  console.error("\n[AMS] Database configuration error\n");
  console.error(message);
  if (hint) console.error(`\nHint: ${hint}\n`);
  process.exit(1);
}

function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) parsed.password = "*****";
    return parsed.toString();
  } catch {
    return rawUrl.replace(/\/\/[^:]+:[^@]+@/, "//*****:*****@");
  }
}

if (!url) {
  fail(
    "DATABASE_URL is not set.",
    'Copy .env.example to .env and set DATABASE_URL="postgresql://zebl:zebl_dev_password@localhost:5432/zebl_ams"'
  );
}

if (url.startsWith("file:") || url.includes("sqlite")) {
  fail(
    `DATABASE_URL is SQLite (${sanitizeUrl(url)}). Prisma schema requires PostgreSQL.`,
    'Update .env: DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE" — see docs/DATABASE_SETUP.md'
  );
}

if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
  fail(
    `DATABASE_URL must start with postgresql:// or postgres://. Got: ${sanitizeUrl(url).slice(0, 50)}…`,
    "See .env.example for Docker, Neon, Supabase, or Railway formats."
  );
}

console.log("[AMS] DATABASE_URL OK (PostgreSQL)");
