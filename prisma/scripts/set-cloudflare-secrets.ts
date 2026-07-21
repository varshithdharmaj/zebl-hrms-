/**
 * Provision Cloudflare Worker secrets from the environment.
 *
 * Never hardcode credentials in this file. Never log secret values.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "..."   # from Supabase dashboard / password manager
 *   $env:DIRECT_URL = "..."     # optional
 *   $env:AUTH_SECRET = "..."
 *   npx tsx prisma/scripts/set-cloudflare-secrets.ts
 *
 * Usage (bash):
 *   export DATABASE_URL='...'
 *   export AUTH_SECRET='...'
 *   npx tsx prisma/scripts/set-cloudflare-secrets.ts
 *
 * Or load from an untracked local env file first:
 *   set -a && source .env.local && set +a && npx tsx prisma/scripts/set-cloudflare-secrets.ts
 *
 * Required env:
 *   DATABASE_URL
 *   AUTH_SECRET
 * Optional env:
 *   DIRECT_URL
 */
import { spawnSync } from "node:child_process";

const REQUIRED_KEYS = ["DATABASE_URL", "AUTH_SECRET"] as const;
const OPTIONAL_KEYS = ["DIRECT_URL"] as const;

function readRequiredEnv(name: (typeof REQUIRED_KEYS)[number]): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[AMS] Missing required environment variable: ${name}`);
    console.error(
      "[AMS] Set it in your shell or untracked .env.local, then re-run this script."
    );
    process.exit(1);
  }
  return value;
}

function readOptionalEnv(name: (typeof OPTIONAL_KEYS)[number]): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function putCloudflareSecret(key: string, value: string): void {
  console.log(`Setting Cloudflare secret: ${key} (value not logged)...`);
  const result = spawnSync("npx", ["wrangler", "secret", "put", key], {
    input: value,
    encoding: "utf-8",
    shell: true,
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.status !== 0) {
    console.error(`[AMS] Failed setting secret ${key} (exit ${result.status ?? "unknown"}).`);
    process.exit(result.status ?? 1);
  }
  console.log(`Secret ${key} set successfully.`);
}

const secrets: Record<string, string> = {
  DATABASE_URL: readRequiredEnv("DATABASE_URL"),
  AUTH_SECRET: readRequiredEnv("AUTH_SECRET"),
};

const directUrl = readOptionalEnv("DIRECT_URL");
if (directUrl) {
  secrets.DIRECT_URL = directUrl;
}

for (const [key, value] of Object.entries(secrets)) {
  putCloudflareSecret(key, value);
}

console.log("[AMS] Done. Confirm secrets in the Cloudflare dashboard; do not commit env files.");
