/**
 * Controlled, one-time promotion of specific users to the `manager` role.
 *
 * This script never infers who should become a Manager — it requires an explicit,
 * human-supplied list of target emails (see list-manager-role-candidates.ts for a
 * read-only report to review first).
 *
 * Uses a standalone PrismaClient rather than importing src/lib/prisma or
 * src/lib/admin/user-management — those transitively import `server-only`, which
 * unconditionally throws under plain `tsx`/Node execution (it only no-ops under
 * Next.js's `react-server` module-resolution condition). Every other script in
 * this directory follows the same standalone-PrismaClient pattern for the same
 * reason. This script replicates the same safety properties changeUserRole()
 * enforces (Super-Admin-actor check, transactional update, audit log entry,
 * session invalidation) directly, rather than reusing that function.
 *
 * Refuses to touch:
 *   - any target not currently role=employee (never re-targets hr/super_admin/
 *     already-manager users — this script promotes employees to manager only)
 *   - recruitment test-manager accounts (RECRUITMENT_TEST_MANAGER_EMAILS)
 *
 * Usage:
 *   npm run db:apply-manager-role -- --actor=admin@zebl.com --users=raj@zebl.com,suresh@zebl.com
 *
 * `--actor` must be the email of an active Super Admin (verified against the DB,
 * not trusted from the command line beyond the lookup).
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { RECRUITMENT_TEST_MANAGER_EMAILS } from "@/lib/recruitment/permissions/recruitment-test-manager";

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

/** PrismaPg + maxUses:1 — avoids PgBouncer prepared-statement clashes on seeds. */
function createPrismaClient(): PrismaClient {
  const url = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, maxUses: 1 }),
    log: ["error", "warn"],
  });
}

function parseArgs(argv: string[]): { actor?: string; users?: string } {
  const out: { actor?: string; users?: string } = {};
  for (const arg of argv) {
    if (arg.startsWith("--actor=")) out.actor = arg.slice("--actor=".length).trim();
    if (arg.startsWith("--users=")) out.users = arg.slice("--users=".length).trim();
  }
  return out;
}

/** Promotes one user from employee -> manager: update + audit log, in one transaction. */
async function promoteToManager(
  prisma: PrismaClient,
  targetId: string,
  actor: { id: string; email: string }
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: targetId } });
    if (!target || target.role !== "employee") {
      throw new Error("target is no longer role=employee (changed concurrently)");
    }
    await tx.user.update({ where: { id: targetId }, data: { role: "manager" } });
    await tx.auditLog.create({
      data: {
        entityType: "user",
        entityId: targetId,
        action: "user.role.changed",
        actorUserId: actor.id,
        actorEmail: actor.email,
        employeeId: target.employeeId,
        module: "employees",
        description: "User role was changed.",
        oldValue: { role: "employee" },
        newValue: { role: "manager" },
        metadata: JSON.stringify({ previousRole: "employee", newRole: "manager", source: "apply-manager-role script" }),
      },
    });
  });

  // Role changes take effect immediately: invalidate the target's existing sessions
  // (mirrors invalidateUserSessions() in src/lib/auth.ts).
  await prisma.user.update({
    where: { id: targetId },
    data: { sessionVersion: { increment: 1 } },
  });
  await prisma.loginSession.updateMany({
    where: { userId: targetId, status: "active" },
    data: { status: "revoked", logoutAt: new Date() },
  });
}

async function main(): Promise<void> {
  const { actor: actorEmailArg, users: usersArg } = parseArgs(process.argv.slice(2));

  if (!actorEmailArg || !usersArg) {
    console.error(
      "[AMS] Usage: npm run db:apply-manager-role -- --actor=<super_admin_email> --users=<email1,email2,...>"
    );
    process.exitCode = 1;
    return;
  }

  const actorEmail = actorEmailArg.trim().toLowerCase();
  const targetEmails = [
    ...new Set(
      usersArg
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  if (targetEmails.length === 0) {
    console.error("[AMS] No target emails provided.");
    process.exitCode = 1;
    return;
  }

  const testManagerEmails = new Set<string>(RECRUITMENT_TEST_MANAGER_EMAILS);
  const blocked = targetEmails.filter((e) => testManagerEmails.has(e));
  if (blocked.length > 0) {
    console.error(
      `[AMS] Refusing to run: recruitment test-manager account(s) present in --users: ${blocked.join(", ")}. ` +
        "These must not become production Manager accounts."
    );
    process.exitCode = 1;
    return;
  }

  const prisma = createPrismaClient();
  try {
    const actorUser = await prisma.user.findUnique({ where: { email: actorEmail } });
    if (!actorUser) {
      console.error(`[AMS] Actor not found: ${actorEmail}`);
      process.exitCode = 1;
      return;
    }
    if (actorUser.role !== "super_admin" || !actorUser.isActive) {
      console.error(
        `[AMS] Actor ${actorEmail} is not an active Super Admin (role=${actorUser.role}, isActive=${actorUser.isActive}). Refusing.`
      );
      process.exitCode = 1;
      return;
    }

    let succeeded = 0;
    let failed = 0;
    for (const email of targetEmails) {
      const target = await prisma.user.findUnique({ where: { email } });
      if (!target) {
        console.error(`  [skip] ${email}: no such user.`);
        failed += 1;
        continue;
      }
      if (target.role !== "employee") {
        console.error(
          `  [skip] ${email}: current role is '${target.role}', not 'employee' — this script only promotes employee -> manager.`
        );
        failed += 1;
        continue;
      }
      try {
        await promoteToManager(prisma, target.id, actorUser);
        console.log(`  [ok]   ${email}: promoted to manager.`);
        succeeded += 1;
      } catch (e) {
        console.error(`  [fail] ${email}: ${e instanceof Error ? e.message : String(e)}`);
        failed += 1;
      }
    }

    console.log(`\n[AMS] Done. ${succeeded} promoted, ${failed} skipped/failed.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[AMS] apply-manager-role failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
