import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LoginSessionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  closeSession,
  getLoginHistory,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/lib/security/login-history-service";

const marker = `login-history-integration-${Date.now()}`;
let ready = false;
let employeeId = 0;
let userId = "";

const context = {
  ipAddress: "192.0.2.25",
  browser: "Chrome",
  browserVersion: "126",
  device: "Desktop",
  operatingSystem: "Windows",
  userAgent: marker,
};

async function databaseReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("login history integration", () => {
  beforeAll(async () => {
    ready = await databaseReady();
    if (!ready) return;
    const employee = await prisma.employee.create({
      data: {
        employeeCode: `LOGIN-${Date.now()}`,
        name: "Login Integration User",
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
      },
    });
    userId = user.id;
  }, 30_000);

  afterAll(async () => {
    if (!ready) return;
    await prisma.loginSession.deleteMany({
      where: {
        OR: [
          { userId },
          { attemptedEmail: `${marker}-failed@example.com` },
        ],
      },
    });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.employee.delete({ where: { id: employeeId } });
    await prisma.$disconnect();
  }, 30_000);

  it("persists, scopes and closes a successful session", async () => {
    if (!ready) return;
    await recordSuccessfulLogin({
      sessionId: marker,
      userId,
      employeeId,
      context,
    });
    const history = await getLoginHistory({}, { employeeId });
    expect(history.total).toBe(1);
    expect(history.rows[0]?.status).toBe(LoginSessionStatus.active);

    await closeSession(marker, LoginSessionStatus.logged_out);
    const closed = await prisma.loginSession.findUnique({ where: { id: marker } });
    expect(closed?.status).toBe(LoginSessionStatus.logged_out);
    expect(closed?.logoutAt).not.toBeNull();
    expect(closed?.isCurrent).toBe(false);
  }, 30_000);

  it("persists failed attempts without a user relation", async () => {
    if (!ready) return;
    await recordFailedLogin({
      attemptedEmail: `${marker}-failed@example.com`,
      reason: "invalid_credentials",
      context,
    });
    const failed = await prisma.loginSession.findFirst({
      where: { attemptedEmail: `${marker}-failed@example.com` },
    });
    expect(failed?.status).toBe(LoginSessionStatus.failed);
    expect(failed?.userId).toBeNull();
  }, 30_000);
});
