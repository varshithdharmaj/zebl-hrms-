/**
 * Shared helpers for minimal recruitment demo seed.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AuthProvider, UserRole } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/session";
import { DEMO_PASSWORD, MIN_MARKER, MIN_PREFIX } from "./catalog";

export function loadEnvFiles(): void {
  for (const name of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
  process.env.RECRUITMENT_MODULE_ENABLED ??= "true";
  process.env.RECRUITMENT_OFFERS_ENABLED ??= "true";
  process.env.RECRUITMENT_CONVERSION_ENABLED ??= "true";
}

export function createPrisma(): PrismaClient {
  const url = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, maxUses: 1 }),
    log: ["error"],
  });
}

export function log(msg: string): void {
  console.log(`[seed:demo] ${msg}`);
}

export function daysAgo(n: number, hour = 10): Date {
  const d = new Date();
  d.setHours(hour, (n * 11) % 50, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export function daysFromNow(n: number, hour = 11): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

export function iso(d: Date): string {
  return d.toISOString();
}

export function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600_000);
}

export type StaffRef = {
  id: number;
  userId: string;
  email: string;
  name: string;
};

export type DemoCtx = {
  prisma: PrismaClient;
  session: SessionUser;
  force: boolean;
  staff: Map<string, StaffRef>;
  jobs: Map<string, { id: string; title: string; dept: string; loc: string }>;
  candidates: Map<string, { id: string; email: string; name: string }>;
  apps: Map<string, { id: string; candidateId: string; jobId: string; purpose: string }>;
  interviews: string[];
  offers: Map<string, { id: string; purpose: string }>;
  templates: Map<string, string>;
  counts: Record<string, number>;
};

export async function ensureSession(prisma: PrismaClient): Promise<SessionUser> {
  const email = "hr.head@zebl.demo";
  const user = await prisma.user.findUnique({
    where: { email },
    include: { employee: { select: { name: true } } },
  });
  if (!user) throw new Error(`Missing ${email} — seed employees first`);
  return {
    id: user.id,
    email: user.email,
    role: user.role as SessionUser["role"],
    employeeId: user.employeeId,
    employeeName: user.employee?.name ?? null,
    sessionVersion: user.sessionVersion,
    authProvider: user.authProvider ?? AuthProvider.local,
  };
}

export async function isMinDemoPresent(prisma: PrismaClient): Promise<boolean> {
  const job = await prisma.jobOpening.findFirst({
    where: { code: "MIN-JOB-01", deletedAt: null },
    select: { id: true },
  });
  return Boolean(job);
}

export { DEMO_PASSWORD, MIN_MARKER, MIN_PREFIX, UserRole, AuthProvider };
