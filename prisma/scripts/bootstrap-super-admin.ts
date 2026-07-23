/**
 * Idempotent Super Admin bootstrap. Run: npm run db:bootstrap-admin
 *
 * Reads INITIAL_SUPER_ADMIN_EMAIL / INITIAL_SUPER_ADMIN_PASSWORD from the environment.
 * Creates the initial Super Admin ONLY if no active Super Admin exists yet. Safe to run
 * on every deploy/startup — never overwrites an existing user, never re-promotes, never
 * prints the password.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient, UserRole } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";

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

async function main(): Promise<void> {
  const email = process.env.INITIAL_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "[AMS] INITIAL_SUPER_ADMIN_EMAIL / INITIAL_SUPER_ADMIN_PASSWORD not set — skipping bootstrap."
    );
    return;
  }
  if (password.length < 8) {
    console.error("[AMS] INITIAL_SUPER_ADMIN_PASSWORD must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const activeSuperAdmins = await prisma.user.count({
      where: { role: UserRole.super_admin, isActive: true },
    });

    if (activeSuperAdmins > 0) {
      console.log(
        `[AMS] ${activeSuperAdmins} active Super Admin(s) already exist — no action taken.`
      );
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.error(
        `[AMS] A user with email ${email} already exists but there is no active Super Admin. ` +
          "Refusing to auto-promote — change this user's role explicitly via Super Admin user management."
      );
      process.exitCode = 1;
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: passwordHash, role: UserRole.super_admin, isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        entityType: "user",
        entityId: user.id,
        action: "user.super_admin.created",
        actorUserId: null,
        actorEmail: null,
        metadata: JSON.stringify({ email, source: "bootstrap" }),
      },
    });

    console.log(`[AMS] Created initial Super Admin: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[AMS] Bootstrap failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
