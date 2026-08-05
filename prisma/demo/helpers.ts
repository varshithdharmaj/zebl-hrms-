/**
 * Shared helpers for ZEBL recruitment demo seeders.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { DEMO_MARKER } from "./constants";

export function loadEnvFiles(): void {
  for (const filename of [".env", ".env.local"]) {
    const path = resolve(process.cwd(), filename);
    if (!existsSync(path)) continue;
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
}

/** Prefer DATABASE_URL with PrismaPg adapter (maxUses:1) — matches app / avoids PgBouncer prep stmt clashes. */
export function createDemoPrismaClient(): PrismaClient {
  const url = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim();
  if (!url) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is not set. Copy .env.example → .env.");
  }
  const adapter = new PrismaPg({ connectionString: url, maxUses: 1 });
  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
    transactionOptions: {
      maxWait: 30_000,
      timeout: 120_000,
    },
  });
}

export const TX_OPTS = { timeout: 120_000, maxWait: 30_000 } as const;

/** Deterministic PRNG (mulberry32). */
export function createRng(seed = 20260805): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function pickN<T>(rng: () => number, items: readonly T[], n: number): T[] {
  const copy = [...items];
  const out: T[] = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

export function daysAgo(days: number, hour = 10): Date {
  const d = new Date();
  d.setHours(hour, Math.floor((days * 17) % 50), 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export function daysFromNow(days: number, hour = 11): Date {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function indianPhone(rng: () => number, index: number): string {
  const prefixes = ["98", "97", "96", "95", "94", "93", "91", "90", "89", "88"];
  const prefix = prefixes[index % prefixes.length]!;
  const rest = String(10000000 + Math.floor(rng() * 89999999)).slice(0, 8);
  return `+91${prefix}${rest}`;
}

export function demoMeta(extra: Record<string, unknown> = {}): Prisma.InputJsonValue {
  return { demoSeed: DEMO_MARKER, ...extra };
}

export function logStep(message: string): void {
  console.log(`[demo-seed] ${message}`);
}

export async function ensureDefaultPipeline(
  prisma: PrismaClient
): Promise<{
  templateId: string;
  stages: Array<{
    stage: string;
    sortOrder: number;
    isOptional: boolean;
    label: string | null;
    slaDays: number | null;
  }>;
}> {
  let template = await prisma.recruitmentPipelineTemplate.findFirst({
    where: { id: "recruitment_default_pipeline_v1", deletedAt: null },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });

  if (!template) {
    template = await prisma.recruitmentPipelineTemplate.findFirst({
      where: { isActive: true, deletedAt: null },
      include: { stages: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!template || template.stages.length === 0) {
    throw new Error(
      "No recruitment pipeline template found. Run migrations (recruitment foundation) before demo:seed."
    );
  }

  await prisma.recruitmentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      defaultPipelineTemplateId: template.id,
      slaDaysPerStageJson: {},
      metadata: demoMeta({ company: "ZEBL Technologies Pvt Ltd" }),
    },
    update: {
      defaultPipelineTemplateId: template.id,
    },
  });

  return {
    templateId: template.id,
    stages: template.stages.map((s) => ({
      stage: s.stage,
      sortOrder: s.sortOrder,
      isOptional: s.isOptional,
      label: s.label,
      slaDays: s.slaDays,
    })),
  };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
