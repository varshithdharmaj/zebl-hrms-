/**
 * Clean database initialization (AWS PostgreSQL or any fresh environment):
 * system/reference config + exactly 4 initial logins. Super Admin is handled
 * separately by db:bootstrap-admin (already the right pattern — unchanged).
 *
 * Creates ONLY:
 *   - IntegrationSettings / PayrollSettings / AttendanceSettings (id="default")
 *   - HR login                         (User only, no Employee)
 *   - John Doe                         (Employee + User, role=employee)
 *   - Test Manager 1 / Test Manager 2  (Employee + User, role=manager, unattached)
 *
 * Does NOT seed: demo attendance/leave data, recruitment data, additional
 * employees, RecruitmentSettings (recruitment module stays off), or
 * recruitmentOpsAccess (unrelated capability — not part of this role set).
 *
 * Does NOT copy any password hash from another database. Every password is
 * freshly hashed here from a required environment variable.
 *
 * Idempotent: safe to re-run. Config rows are always upserted. Existing users'
 * passwords are left untouched on re-run UNLESS AWS_INIT_RESET_PASSWORDS=true.
 *
 * Required env:
 *   AWS_INIT_CONFIRM=true            — explicit safety gate, distinct from any
 *                                       other seed script's gate
 *   HR_INITIAL_EMAIL / HR_INITIAL_PASSWORD
 *   JOHN_DOE_EMAIL / JOHN_DOE_INITIAL_PASSWORD
 *   TEST_MANAGER_1_EMAIL / TEST_MANAGER_1_PASSWORD
 *   TEST_MANAGER_2_EMAIL / TEST_MANAGER_2_PASSWORD
 *
 * Optional env:
 *   AWS_INIT_RESET_PASSWORDS=true    — also overwrite passwords on re-run
 *
 * Run: npm run db:seed:aws-init
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AccountStatus,
  AuthProvider,
  PrismaClient,
  UserRole,
} from "@/generated/prisma/client";
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

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[AMS] ${name} is required.`);
    process.exitCode = 1;
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function requireEmail(name: string): string {
  const value = requireEnv(name).toLowerCase();
  const reserved = new Set<string>(RECRUITMENT_TEST_MANAGER_EMAILS);
  if (reserved.has(value)) {
    console.error(
      `[AMS] ${name} (${value}) is a reserved recruitment test-manager email — refusing to use it here.`
    );
    process.exitCode = 1;
    throw new Error(`Reserved email used for ${name}`);
  }
  return value;
}

function requirePassword(name: string): string {
  const value = requireEnv(name);
  if (value.length < 8) {
    console.error(`[AMS] ${name} must be at least 8 characters.`);
    process.exitCode = 1;
    throw new Error(`${name} too short`);
  }
  return value;
}

const JOINING = new Date();
const RESET_PASSWORDS = process.env.AWS_INIT_RESET_PASSWORDS === "true";

type Init = {
  email: string;
  password: string;
};

type EmployeeLogin = Init & {
  employeeCode: string;
  name: string;
  designation: string;
};

async function upsertConfigRows(prisma: PrismaClient): Promise<void> {
  await prisma.integrationSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  await prisma.payrollSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  await prisma.attendanceSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

/** HR: User only, no Employee — matches the existing seed.ts pattern for hr@zebl.com. */
async function upsertHrUser(prisma: PrismaClient, init: Init): Promise<string> {
  const passwordHash = await bcrypt.hash(init.password, 10);
  const existing = await prisma.user.findUnique({ where: { email: init.email } });

  const user = await prisma.user.upsert({
    where: { email: init.email },
    create: {
      email: init.email,
      password: passwordHash,
      role: UserRole.hr,
      authProvider: AuthProvider.local,
      isActive: true,
      accountStatus: AccountStatus.active,
      sessionVersion: 1,
      mustChangePassword: true,
    },
    update: {
      ...(existing && !RESET_PASSWORDS ? {} : { password: passwordHash }),
      role: UserRole.hr,
      isActive: true,
      accountStatus: AccountStatus.active,
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  return existing ? "existing (updated)" : "created";
}

/** Employee + User, for John Doe and the two Test Managers. */
async function upsertEmployeeLogin(
  prisma: PrismaClient,
  def: EmployeeLogin,
  role: (typeof UserRole)[keyof typeof UserRole]
): Promise<string> {
  const [firstName, ...rest] = def.name.split(" ");
  const lastName = rest.join(" ") || null;

  const employee = await prisma.employee.upsert({
    where: { employeeCode: def.employeeCode },
    create: {
      employeeCode: def.employeeCode,
      name: def.name,
      firstName,
      lastName,
      email: def.email,
      designation: def.designation,
      employeeStatus: "Active",
      isActive: true,
      joiningDate: JOINING,
      managerId: null,
    },
    update: {
      name: def.name,
      firstName,
      lastName,
      email: def.email,
      designation: def.designation,
      employeeStatus: "Active",
      isActive: true,
    },
  });

  const passwordHash = await bcrypt.hash(def.password, 10);
  const existing = await prisma.user.findUnique({ where: { email: def.email } });

  const user = await prisma.user.upsert({
    where: { email: def.email },
    create: {
      email: def.email,
      password: passwordHash,
      role,
      authProvider: AuthProvider.local,
      isActive: true,
      accountStatus: AccountStatus.active,
      sessionVersion: 1,
      mustChangePassword: true,
      employeeId: employee.id,
    },
    update: {
      ...(existing && !RESET_PASSWORDS ? {} : { password: passwordHash }),
      role,
      isActive: true,
      accountStatus: AccountStatus.active,
      employeeId: employee.id,
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });

  return existing ? "existing (updated)" : "created";
}

async function main(): Promise<void> {
  if (process.env.AWS_INIT_CONFIRM !== "true") {
    console.error(
      "[AMS] Refusing to run: set AWS_INIT_CONFIRM=true to confirm this is the intended target database."
    );
    process.exitCode = 1;
    return;
  }

  const hr: Init = {
    email: requireEmail("HR_INITIAL_EMAIL"),
    password: requirePassword("HR_INITIAL_PASSWORD"),
  };
  const johnDoe: EmployeeLogin = {
    email: requireEmail("JOHN_DOE_EMAIL"),
    password: requirePassword("JOHN_DOE_INITIAL_PASSWORD"),
    employeeCode: "EMP-JDOE",
    name: "John Doe",
    designation: "Employee",
  };
  const manager1: EmployeeLogin = {
    email: requireEmail("TEST_MANAGER_1_EMAIL"),
    password: requirePassword("TEST_MANAGER_1_PASSWORD"),
    employeeCode: "MGR-INIT-01",
    name: "Test Manager 1",
    designation: "Manager",
  };
  const manager2: EmployeeLogin = {
    email: requireEmail("TEST_MANAGER_2_EMAIL"),
    password: requirePassword("TEST_MANAGER_2_PASSWORD"),
    employeeCode: "MGR-INIT-02",
    name: "Test Manager 2",
    designation: "Manager",
  };

  const emails = [hr.email, johnDoe.email, manager1.email, manager2.email];
  if (new Set(emails).size !== emails.length) {
    console.error("[AMS] HR/John Doe/Test Manager emails must all be distinct.");
    process.exitCode = 1;
    return;
  }

  const prisma = createPrismaClient();
  try {
    await upsertConfigRows(prisma);
    console.log("[AMS] Config rows ready: IntegrationSettings, PayrollSettings, AttendanceSettings.");

    const hrStatus = await upsertHrUser(prisma, hr);
    console.log(`[AMS] HR (${hr.email}): ${hrStatus}, role=hr.`);

    const johnStatus = await upsertEmployeeLogin(prisma, johnDoe, UserRole.employee);
    console.log(`[AMS] John Doe (${johnDoe.email}): ${johnStatus}, role=employee.`);

    const mgr1Status = await upsertEmployeeLogin(prisma, manager1, UserRole.manager);
    console.log(`[AMS] Test Manager 1 (${manager1.email}): ${mgr1Status}, role=manager.`);

    const mgr2Status = await upsertEmployeeLogin(prisma, manager2, UserRole.manager);
    console.log(`[AMS] Test Manager 2 (${manager2.email}): ${mgr2Status}, role=manager.`);

    console.log(
      "\n[AMS] Done. 4 logins ready (Super Admin is provisioned separately via db:bootstrap-admin)." +
        " No business/demo data was created. Passwords not printed."
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[AMS] seed-aws-init failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
