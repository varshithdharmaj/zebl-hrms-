/**
 * Idempotent seed: two line-manager test accounts + partitioned reports +
 * User.recruitmentOpsAccess=true (permanent Recruitment ops capability).
 *
 * Manager capability = UserRole.employee + Employee.managerId hierarchy
 * (there is no UserRole.manager). Isolation is by managerId / PeopleScopeEngine.
 *
 * Run: npm run db:seed:test-managers
 *
 * Env:
 *   TEST_MANAGER_PASSWORD     — required in production; defaults in non-prod
 *   ALLOW_TEST_MANAGER_SEED   — must be "true" when NODE_ENV=production
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
import {
  RECRUITMENT_TEST_MANAGER_EMAILS,
  RECRUITMENT_TEST_MANAGER_EMPLOYEE_CODES,
} from "@/lib/recruitment/permissions/recruitment-test-manager";

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
  if (!url) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is not set.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, maxUses: 1 }),
    log: ["error", "warn"],
  });
}

const DEFAULT_DEV_PASSWORD = "TestMgr@2026";
const JOINING = new Date("2023-01-15T00:00:00.000Z");

type PersonDef = {
  employeeCode: string;
  email: string;
  name: string;
  department: string;
  designation: string;
  withLogin: boolean;
};

const MANAGER_1: PersonDef = {
  employeeCode: RECRUITMENT_TEST_MANAGER_EMPLOYEE_CODES[0],
  email: RECRUITMENT_TEST_MANAGER_EMAILS[0],
  name: "Test Manager One",
  department: "Test Team A",
  designation: "Team Lead",
  withLogin: true,
};

const MANAGER_2: PersonDef = {
  employeeCode: RECRUITMENT_TEST_MANAGER_EMPLOYEE_CODES[1],
  email: RECRUITMENT_TEST_MANAGER_EMAILS[1],
  name: "Test Manager Two",
  department: "Test Team B",
  designation: "Team Lead",
  withLogin: true,
};

const REPORTS_A: PersonDef[] = [
  {
    employeeCode: "TEST-EMP-A1",
    email: "emp-a1.test@zebl.local",
    name: "Test Employee A1",
    department: "Test Team A",
    designation: "Engineer",
    withLogin: true,
  },
  {
    employeeCode: "TEST-EMP-A2",
    email: "emp-a2.test@zebl.local",
    name: "Test Employee A2",
    department: "Test Team A",
    designation: "Engineer",
    withLogin: true,
  },
  {
    employeeCode: "TEST-EMP-A3",
    email: "emp-a3.test@zebl.local",
    name: "Test Employee A3",
    department: "Test Team A",
    designation: "Analyst",
    withLogin: false,
  },
];

const REPORTS_B: PersonDef[] = [
  {
    employeeCode: "TEST-EMP-B1",
    email: "emp-b1.test@zebl.local",
    name: "Test Employee B1",
    department: "Test Team B",
    designation: "Engineer",
    withLogin: true,
  },
  {
    employeeCode: "TEST-EMP-B2",
    email: "emp-b2.test@zebl.local",
    name: "Test Employee B2",
    department: "Test Team B",
    designation: "Engineer",
    withLogin: true,
  },
  {
    employeeCode: "TEST-EMP-B3",
    email: "emp-b3.test@zebl.local",
    name: "Test Employee B3",
    department: "Test Team B",
    designation: "Analyst",
    withLogin: false,
  },
];

function assertSeedAllowed(): void {
  const isProd = process.env.NODE_ENV === "production";
  const allowed = process.env.ALLOW_TEST_MANAGER_SEED === "true";
  if (isProd && !allowed) {
    console.error(
      "[AMS] Refusing test-manager seed in production. Set ALLOW_TEST_MANAGER_SEED=true to proceed."
    );
    process.exit(1);
  }
}

function resolvePassword(): string {
  const fromEnv = process.env.TEST_MANAGER_PASSWORD?.trim();
  if (fromEnv) {
    if (fromEnv.length < 8) {
      console.error("[AMS] TEST_MANAGER_PASSWORD must be at least 8 characters.");
      process.exit(1);
    }
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[AMS] TEST_MANAGER_PASSWORD is required when NODE_ENV=production."
    );
    process.exit(1);
  }
  console.warn(
    `[AMS] TEST_MANAGER_PASSWORD unset — using non-production default (${DEFAULT_DEV_PASSWORD}).`
  );
  return DEFAULT_DEV_PASSWORD;
}

async function upsertEmployee(
  prisma: PrismaClient,
  def: PersonDef,
  managerId: number | null
): Promise<{ id: number }> {
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
      department: def.department,
      designation: def.designation,
      employmentType: "Full Time",
      workLocation: "Hyderabad",
      employeeStatus: "Active",
      isActive: true,
      joiningDate: JOINING,
      managerId,
    },
    update: {
      name: def.name,
      firstName,
      lastName,
      email: def.email,
      department: def.department,
      designation: def.designation,
      employeeStatus: "Active",
      isActive: true,
      managerId,
    },
  });

  await prisma.employeeLeaveBalance.upsert({
    where: { employeeId: employee.id },
    create: {
      employeeId: employee.id,
      elBalance: 15,
      clBalance: 12,
      slBalance: 12,
    },
    update: {
      elBalance: 15,
      clBalance: 12,
      slBalance: 12,
    },
  });

  return { id: employee.id };
}

async function upsertLogin(
  prisma: PrismaClient,
  def: PersonDef,
  employeeId: number,
  passwordHash: string,
  recruitmentOpsAccess: boolean
): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: def.email },
    create: {
      email: def.email,
      password: passwordHash,
      role: UserRole.employee,
      authProvider: AuthProvider.local,
      isActive: true,
      accountStatus: AccountStatus.active,
      sessionVersion: 1,
      mustChangePassword: false,
      recruitmentOpsAccess,
      employeeId,
    },
    update: {
      password: passwordHash,
      role: UserRole.employee,
      authProvider: AuthProvider.local,
      isActive: true,
      accountStatus: AccountStatus.active,
      mustChangePassword: false,
      recruitmentOpsAccess,
      employeeId,
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
  });
}

async function main(): Promise<void> {
  assertSeedAllowed();
  const password = resolvePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const prisma = createPrismaClient();

  try {
    const mgr1 = await upsertEmployee(prisma, MANAGER_1, null);
    const mgr2 = await upsertEmployee(prisma, MANAGER_2, null);

    await upsertLogin(prisma, MANAGER_1, mgr1.id, passwordHash, true);
    await upsertLogin(prisma, MANAGER_2, mgr2.id, passwordHash, true);

    for (const def of REPORTS_A) {
      const emp = await upsertEmployee(prisma, def, mgr1.id);
      if (def.withLogin) {
        await upsertLogin(prisma, def, emp.id, passwordHash, false);
      }
    }

    for (const def of REPORTS_B) {
      const emp = await upsertEmployee(prisma, def, mgr2.id);
      if (def.withLogin) {
        await upsertLogin(prisma, def, emp.id, passwordHash, false);
      }
    }

    // Ensure managers are not linked to each other (isolation for concurrent tests).
    await prisma.employee.update({
      where: { id: mgr1.id },
      data: { managerId: null },
    });
    await prisma.employee.update({
      where: { id: mgr2.id },
      data: { managerId: null },
    });

    console.log("[AMS] Test managers seeded (idempotent).");
    console.log(`  Manager 1: ${MANAGER_1.email}  (${MANAGER_1.department})`);
    console.log(`  Manager 2: ${MANAGER_2.email}  (${MANAGER_2.department})`);
    console.log(
      `  Reports: ${REPORTS_A.length} under Mgr1, ${REPORTS_B.length} under Mgr2`
    );
    console.log(
      "  Role: employee + hierarchy; recruitmentOpsAccess=true. Password not printed."
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[AMS] Test-manager seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
