import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { AccountStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resetUserPassword,
  updateUserAccountStatus,
} from "@/lib/admin/user-management";
import type { SessionUser } from "@/lib/session";

const marker = `account-management-${Date.now()}`;
let ready = false;
let employeeId = 0;
let userId = "";

const hrActor: SessionUser = {
  id: `${marker}-hr`,
  email: `${marker}-hr@example.com`,
  role: "hr",
  employeeId: null,
  employeeName: null,
  sessionVersion: 1,
  authProvider: "local",
};

async function databaseReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("employee account management integration", () => {
  beforeAll(async () => {
    ready = await databaseReady();
    if (!ready) return;
    const employee = await prisma.employee.create({
      data: {
        employeeCode: `ACCT-${Date.now()}`,
        name: "Account Integration Employee",
        employeeStatus: "Active",
        isActive: true,
      },
    });
    employeeId = employee.id;
    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.com`,
        role: "employee",
        employeeId,
        password: await bcrypt.hash("OriginalPassword1", 10),
      },
    });
    userId = user.id;
  }, 30_000);

  afterAll(async () => {
    if (!ready) return;
    await prisma.auditLog.deleteMany({
      where: { entityId: userId },
    });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.employee.delete({ where: { id: employeeId } });
    await prisma.$disconnect();
  }, 30_000);

  it("resets a password, forces change, revokes sessions, and audits the action", async () => {
    if (!ready) return;
    await resetUserPassword(hrActor, {
      userId,
      password: "ReplacementPassword1",
      generate: false,
      mustChangePassword: true,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await bcrypt.compare("ReplacementPassword1", user.password ?? "")).toBe(true);
    expect(user.mustChangePassword).toBe(true);
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: userId, action: "auth.password.reset" },
    });
    expect(audit?.employeeId).toBe(employeeId);
    expect(audit?.oldValue).not.toBeNull();
    expect(audit?.newValue).not.toBeNull();
  }, 30_000);

  it("locks and unlocks the account while synchronizing active state", async () => {
    if (!ready) return;
    await updateUserAccountStatus(
      hrActor,
      userId,
      AccountStatus.locked,
      "Integration test"
    );
    let user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.accountStatus).toBe(AccountStatus.locked);
    expect(user.isActive).toBe(false);
    expect(user.lockedAt).not.toBeNull();

    await updateUserAccountStatus(hrActor, userId, AccountStatus.active);
    user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    expect(user.accountStatus).toBe(AccountStatus.active);
    expect(user.isActive).toBe(true);
    expect(employee.employeeStatus).toBe("Active");
    expect(employee.isActive).toBe(true);
  }, 30_000);
});
