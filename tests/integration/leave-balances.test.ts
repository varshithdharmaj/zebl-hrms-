import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getLeaveBalanceSummaries, initializeEmployeeLeaveBalances } from "@/lib/leave";
import { UserRole } from "@prisma/client";

async function isDatabaseReady(): Promise<boolean> {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("Leave balance summaries (integration)", () => {
  let ready = false;
  const run = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!ready) return;
      await fn();
    });

  let employeeId: number;

  beforeAll(async () => {
    ready = await isDatabaseReady();
    if (!ready) return;

    const suffix = Date.now();
    const employee = await prisma.employee.create({
      data: {
        employeeCode: `B${suffix}`,
        name: "Balance Test Employee",
        joiningDate: new Date("2020-01-01"), // 1+ years -> EL eligible
        employeeStatus: "Active",
        isActive: true,
      },
    });
    employeeId = employee.id;

    // Initialize base balances (EL: 5, CL: 10, SL: 8)
    await initializeEmployeeLeaveBalances(employeeId, { el: 5, cl: 10, sl: 8 }, "integration-test");
  }, 30000);

  afterAll(async () => {
    if (!ready) return;
    await prisma.leaveTransaction.deleteMany({ where: { employeeId } });
    await prisma.employeeLeaveBalance.deleteMany({ where: { employeeId } });
    await prisma.employee.delete({ where: { id: employeeId } });
    await prisma.$disconnect();
  }, 30000);

  run("aggregates leave transactions correctly with groupBy and manual adjustments", async () => {
    // Seed transactions for CL:
    // 1. Accrual +3
    // 2. Deduction -2
    // 3. Manual adjustment +1.5
    // 4. Manual adjustment -0.5
    await prisma.leaveTransaction.createMany({
      data: [
        {
          employeeId,
          leaveType: "CL",
          transactionType: "accrual",
          amount: 3.0,
          createdBy: "integration-test",
          reason: "Test accrual",
        },
        {
          employeeId,
          leaveType: "CL",
          transactionType: "deduction",
          amount: 2.0,
          createdBy: "integration-test",
          reason: "Test deduction",
        },
        {
          employeeId,
          leaveType: "CL",
          transactionType: "manual_adjustment",
          amount: 1.5,
          createdBy: "integration-test",
          reason: "Test manual adjustment positive",
        },
        {
          employeeId,
          leaveType: "CL",
          transactionType: "manual_adjustment",
          amount: -0.5,
          createdBy: "integration-test",
          reason: "Test manual adjustment negative",
        },
      ],
    });

    const summaries = await getLeaveBalanceSummaries(employeeId, { processAccruals: false });
    const cl = summaries.find((s) => s.leaveType === "CL")!;

    expect(cl).toBeDefined();

    // Check calculations:
    // used = deduction (2) + absolute value of manual adjustment if negative (0.5) = 2.5
    expect(cl.used).toBe(2.5);

    // remaining = initial remaining (22)
    expect(cl.remaining).toBe(22);

    // total = remaining (22) + used (2.5) = 24.5
    expect(cl.total).toBe(24.5);
  });
});
