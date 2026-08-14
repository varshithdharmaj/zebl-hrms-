/**
 * Read-only report: employees who currently function as line managers (via
 * Employee.managerId — at least one active, non-terminal direct report) but
 * whose linked User still has role `employee`.
 *
 * This does NOT modify anything. It exists because the pre-existing
 * three_role_model migration (2026-07-20) collapsed `manager -> employee`
 * without preserving which users had been managers, so there is no reliable,
 * automatic way to know who should be promoted to the `manager` role. A human
 * must review this list and select who to promote — see apply-manager-role.ts.
 *
 * Recruitment test-manager accounts (RECRUITMENT_TEST_MANAGER_EMAILS) are
 * excluded: they exist for recruitment-ops testing, not as production Manager
 * candidates, and must not be confused with real promotion candidates.
 *
 * Run: npm run db:list-manager-candidates
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

function createPrismaClient(): PrismaClient {
  const url = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, maxUses: 1 }),
    log: ["error", "warn"],
  });
}

const TERMINAL_EMPLOYEE_STATUSES = ["Resigned", "Terminated"];
const TEST_MANAGER_EMAILS = new Set<string>(RECRUITMENT_TEST_MANAGER_EMAILS);

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    const managerIds = await prisma.employee.findMany({
      where: {
        isActive: true,
        employeeStatus: { notIn: TERMINAL_EMPLOYEE_STATUSES },
        managerId: { not: null },
      },
      select: { managerId: true },
      distinct: ["managerId"],
    });
    const distinctManagerIds = managerIds
      .map((r) => r.managerId)
      .filter((id): id is number => id != null);

    if (distinctManagerIds.length === 0) {
      console.log("[AMS] No employees currently have direct reports. Nothing to report.");
      return;
    }

    const candidates = await prisma.employee.findMany({
      where: {
        id: { in: distinctManagerIds },
        user: { role: "employee" },
      },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        department: true,
        designation: true,
        user: { select: { id: true, email: true, isActive: true } },
        _count: {
          select: {
            directReports: {
              where: {
                isActive: true,
                employeeStatus: { notIn: TERMINAL_EMPLOYEE_STATUSES },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const reviewable = candidates.filter(
      (c) => c.user != null && !TEST_MANAGER_EMAILS.has(c.user.email.toLowerCase())
    );
    const excludedTestManagers = candidates.filter(
      (c) => c.user != null && TEST_MANAGER_EMAILS.has(c.user.email.toLowerCase())
    );

    console.log(
      `[AMS] ${reviewable.length} employee(s) have direct reports and a linked User with role=employee.\n` +
        "These are CANDIDATES ONLY — nothing has been changed. Review each one, then promote\n" +
        "deliberately via the User Management UI or:\n" +
        "  npm run db:apply-manager-role -- --actor=<super_admin_email> --users=<email1,email2,...>\n"
    );

    for (const c of reviewable) {
      console.log(
        `  ${c.employeeCode.padEnd(12)} ${c.name.padEnd(28)} ${(c.user?.email ?? "").padEnd(32)} ` +
          `reports=${c._count.directReports} dept=${c.department ?? "-"} title=${c.designation ?? "-"} ` +
          `active=${c.user?.isActive}`
      );
    }

    if (excludedTestManagers.length > 0) {
      console.log(
        `\n[AMS] Excluded ${excludedTestManagers.length} recruitment test-manager account(s) ` +
          "(RECRUITMENT_TEST_MANAGER_EMAILS) — these are not production Manager candidates."
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[AMS] Failed to list Manager candidates:", e instanceof Error ? e.message : e);
  process.exit(1);
});
