/**
 * Tests TCP + Prisma connectivity. Run: npm run db:ping
 */
import { createConnection } from "net";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

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

function parseHost(url: string): { host: string; port: number; database: string } {
  try {
    const parsed = new URL(url.replace(/^postgres:\/\//, "postgresql://"));
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
      database: parsed.pathname.replace(/^\//, "") || "postgres",
    };
  } catch {
    return { host: "localhost", port: 5432, database: "unknown" };
  }
}

function tcpReachable(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

function fail(message: string, help: string): never {
  console.error("\n[AMS] PostgreSQL connection failed\n");
  console.error(message);
  console.error(`\n${help}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    fail("DATABASE_URL must be a PostgreSQL URL.", "Run: npm run db:check-env");
  }

  const { host, port, database } = parseHost(url);
  // Never log credentials — host/port/database only
  console.log(`[AMS] Target: ${host}:${port}/${database} (ssl=${url.includes("sslmode=require")})`);

  const tcpOk = await tcpReachable(host, port);
  if (!tcpOk) {
    const help = [
      `Nothing is listening on ${host}:${port}.`,
      "",
      host === "localhost" || host === "127.0.0.1"
        ? "  • Docker: install Docker Desktop → npm run db:postgres:up"
        : "  • Check host firewall and that the cloud DB is active",
      "  • Or use Neon/Supabase and update DATABASE_URL in .env",
      "",
      "See docs/POSTGRES_WINDOWS_SETUP.md",
    ].join("\n");
    fail(`TCP connection to ${host}:${port} refused.`, help);
  }

  console.log(`[AMS] TCP ${host}:${port} OK`);

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[AMS] Prisma query OK — database is ready");
    console.log("[AMS] Next: npm run db:setup  (if first time)  then  npm run dev");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`Prisma connected to port but query failed: ${msg}`, [
      "Database may not exist or credentials may be wrong.",
      "  • Docker: npm run db:postgres:up && npm run db:setup",
      "  • Check USER/PASSWORD in DATABASE_URL match docker-compose.yml",
    ].join("\n"));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
