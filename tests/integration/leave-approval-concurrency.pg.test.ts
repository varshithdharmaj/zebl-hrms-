/**
 * P0-2 — Real PostgreSQL multi-connection concurrency verification.
 *
 * Uses two child processes (each with its own Prisma client) against DATABASE_URL /
 * DIRECT_URL. Skips cleanly when Postgres is unavailable.
 *
 * Does not mutate production leave business logic.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ApprovalStepStatus,
  LeaveWorkflowStatus,
  UserRole,
} from "@/generated/prisma/client";

function loadEnvFile(filePath: string) {
  try {
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i < 0) continue;
      const key = trimmed.slice(0, i).trim();
      let value = trimmed.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

// Prefer direct session connection for concurrent interactive transactions.
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL.trim();
}

const { prisma } = await import("@/lib/prisma");
const { createLeaveWorkflow, toWorkflowActor } = await import(
  "@/lib/workflow/leave-workflow"
);

const CODE_PREFIX = `CQC${Date.now().toString(36).toUpperCase()}`;
const YEAR = new Date().getFullYear();

type WorkerResult = {
  ok: boolean;
  op?: string;
  leaveId?: number;
  workflowStatus?: string;
  message?: string;
  error?: string;
  name?: string;
};

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

async function runWorker(payload: unknown): Promise<WorkerResult> {
  const workerPath = "./tests/integration/helpers/leave-concurrency-worker.ts";
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "./scripts/mock-server-only-register.mjs",
        "--import",
        "tsx",
        workerPath,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          // Force worker onto the same URL the parent resolved (direct preferred).
          DATABASE_URL: process.env.DATABASE_URL,
          LEAVE_CONCURRENCY_FORCE_DIRECT_URL: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const lines = stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith("{"));
      const last = lines[lines.length - 1];
      if (!last) {
        reject(
          new Error(
            `Worker produced no JSON (code=${code}). stderr=${stderr.slice(0, 800)} stdout=${stdout.slice(0, 800)}`
          )
        );
        return;
      }
      try {
        resolve(JSON.parse(last) as WorkerResult);
      } catch (error) {
        reject(
          new Error(
            `Worker JSON parse failed: ${String(error)}; line=${last}; stderr=${stderr.slice(0, 400)}`
          )
        );
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

async function seedHrOnlyEmployee(label: string, clBalance: number) {
  const employee = await prisma.employee.create({
    data: {
      employeeCode: `${CODE_PREFIX}${label}`,
      name: `Concurrency ${label}`,
      joiningDate: new Date("2020-01-01"),
      employeeStatus: "Active",
      isActive: true,
      // No manager → approval chain is HR-only (single final step).
    },
  });

  await prisma.employeeLeaveBalance.create({
    data: {
      employeeId: employee.id,
      elBalance: 0,
      clBalance,
      slBalance: 0,
    },
  });

  // Pre-mark yearly accruals so finalizeApproval's accrual pass is a no-op
  // (except Scenario E, which skips this).
  await prisma.leaveTransaction.createMany({
    data: [
      {
        employeeId: employee.id,
        leaveType: "CL",
        transactionType: "accrual",
        amount: clBalance,
        reason: `CL yearly allocation ${YEAR}`,
        createdBy: "concurrency-test",
      },
      {
        employeeId: employee.id,
        leaveType: "SL",
        transactionType: "accrual",
        amount: 0.01,
        reason: `SL yearly allocation ${YEAR}`,
        createdBy: "concurrency-test",
      },
    ],
  });

  const user = await prisma.user.create({
    data: {
      email: `${CODE_PREFIX.toLowerCase()}-${label}@test.local`,
      role: UserRole.employee,
      employeeId: employee.id,
    },
  });

  return { employee, user };
}

async function createPendingClLeave(
  employeeId: number,
  user: { id: string; email: string },
  days: number,
  reason: string
) {
  const startDate = new Date("2026-09-01T00:00:00.000Z");
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + Math.max(days, 1) - 1);

  const { leaveId } = await createLeaveWorkflow({
    employeeId,
    leaveType: "CL",
    startDate,
    endDate,
    days,
    reason,
    actor: toWorkflowActor({
      id: user.id,
      email: user.email,
      role: "employee",
      employeeId,
    }),
  });

  const leave = await prisma.leaveRequest.findUniqueOrThrow({
    where: { id: leaveId },
    include: { approvalSteps: true, currentStep: true },
  });

  expect(leave.workflowStatus).toBe(LeaveWorkflowStatus.pending_approval);
  expect(leave.approvalSteps).toHaveLength(1);
  expect(leave.approvalSteps[0]?.approverRole).toBe("hr_admin");

  return leave;
}

async function snapshot(employeeId: number, leaveIds: number[]) {
  const [balance, leaves, txs, steps] = await Promise.all([
    prisma.employeeLeaveBalance.findUniqueOrThrow({ where: { employeeId } }),
    prisma.leaveRequest.findMany({
      where: { id: { in: leaveIds } },
      select: { id: true, workflowStatus: true, version: true, days: true },
      orderBy: { id: "asc" },
    }),
    prisma.leaveTransaction.findMany({
      where: { employeeId },
      select: {
        id: true,
        leaveType: true,
        transactionType: true,
        amount: true,
        leaveRequestId: true,
        reason: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.leaveApprovalStep.findMany({
      where: { leaveRequestId: { in: leaveIds } },
      select: { leaveRequestId: true, status: true, stepOrder: true },
      orderBy: [{ leaveRequestId: "asc" }, { stepOrder: "asc" }],
    }),
  ]);

  const deductions = txs.filter((t) => t.transactionType === "deduction");
  const systemAccruals = txs.filter(
    (t) =>
      t.transactionType === "accrual" &&
      t.leaveRequestId == null &&
      t.reason != null
  );
  const approvedCount = leaves.filter(
    (l) => l.workflowStatus === LeaveWorkflowStatus.approved
  ).length;

  return {
    balance,
    leaves,
    txs,
    steps,
    deductions,
    systemAccruals,
    approvedCount,
    deductedDays: deductions.reduce((s, t) => s + t.amount, 0),
  };
}

describe("P0-2 leave approval concurrency (real PostgreSQL)", () => {
  let ready = false;
  let hrActor: {
    id: string;
    email: string;
    role: "hr" | "super_admin";
    employeeId: number | null;
  };
  const createdEmployeeIds: number[] = [];
  const createdUserEmails: string[] = [];

  const run = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!ready) return;
      await fn();
    }, 120_000);

  beforeAll(async () => {
    ready = await isDatabaseReady();
    if (!ready) {
      console.warn(
        "[P0-2 concurrency] BLOCKED/skipped: PostgreSQL DATABASE_URL/DIRECT_URL not reachable."
      );
      return;
    }

    const hr = await prisma.user.findFirst({
      where: { role: { in: [UserRole.hr, UserRole.super_admin] }, isActive: true },
    });
    if (!hr) {
      console.warn("[P0-2 concurrency] skipped: no HR/super_admin user in database.");
      ready = false;
      return;
    }
    hrActor = {
      id: hr.id,
      email: hr.email,
      role: hr.role === UserRole.super_admin ? "super_admin" : "hr",
      employeeId: hr.employeeId,
    };

    const idx = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname::text AS indexname FROM pg_indexes
      WHERE tablename = 'leave_transactions'
        AND indexname IN (
          'leave_transactions_one_per_request_type_idx',
          'leave_transactions_system_accrual_reason_uidx'
        )
    `;
    console.info(
      "[P0-2 concurrency] DB ready. Idempotency indexes present:",
      idx.map((r) => r.indexname)
    );
  }, 60_000);

  afterAll(async () => {
    if (!ready) {
      return;
    }
    try {
      if (createdEmployeeIds.length > 0) {
        await prisma.leaveTransaction.deleteMany({
          where: { employeeId: { in: createdEmployeeIds } },
        });
        await prisma.leaveApprovalStep.deleteMany({
          where: { leaveRequest: { employeeId: { in: createdEmployeeIds } } },
        });
        await prisma.approvalToken.deleteMany({
          where: { leaveRequest: { employeeId: { in: createdEmployeeIds } } },
        });
        await prisma.leaveRequest.deleteMany({
          where: { employeeId: { in: createdEmployeeIds } },
        });
        await prisma.employeeLeaveBalance.deleteMany({
          where: { employeeId: { in: createdEmployeeIds } },
        });
        await prisma.user.deleteMany({
          where: {
            OR: [
              { employeeId: { in: createdEmployeeIds } },
              { email: { in: createdUserEmails } },
            ],
          },
        });
        await prisma.employee.deleteMany({
          where: { id: { in: createdEmployeeIds } },
        });
      }
    } catch {
      // Isolation cleanup is best-effort; leftover rows must not disconnect the shared client.
    }
  }, 60_000);

  run("Scenario A — two requests compete for balance=2 (separate connections)", async () => {
    const { employee, user } = await seedHrOnlyEmployee("A", 2);
    createdEmployeeIds.push(employee.id);
    createdUserEmails.push(user.email);

    const leaveA = await createPendingClLeave(employee.id, user, 2, `${CODE_PREFIX} A1`);
    const leaveB = await createPendingClLeave(employee.id, user, 2, `${CODE_PREFIX} A2`);

    const [r1, r2] = await Promise.all([
      runWorker({
        op: "approve",
        leaveId: leaveA.id,
        expectedVersion: leaveA.version,
        actor: hrActor,
      }),
      runWorker({
        op: "approve",
        leaveId: leaveB.id,
        expectedVersion: leaveB.version,
        actor: hrActor,
      }),
    ]);

    const snap = await snapshot(employee.id, [leaveA.id, leaveB.id]);

    console.info("[Scenario A]", {
      r1,
      r2,
      clBalance: snap.balance.clBalance,
      approvedCount: snap.approvedCount,
      deductions: snap.deductions,
    });

    expect(snap.approvedCount).toBeLessThanOrEqual(1);
    expect(snap.deductions).toHaveLength(1);
    expect(snap.deductedDays).toBe(2);
    expect(snap.balance.clBalance).toBe(0);
    expect(snap.balance.clBalance).toBeGreaterThanOrEqual(0);

    const successes = [r1, r2].filter((r) => r.ok);
    const failures = [r1, r2].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    // Prefer domain errors; under pooler/maxUses contention Prisma may also abort the
    // losing interactive transaction. Either way the DB invariants above must hold.
    expect(failures[0]?.error ?? "").toMatch(
      /Insufficient|updated by another user|already|Transaction not found|Transaction API error/i
    );
  });

  run("Scenario B — same request approved concurrently (separate connections)", async () => {
    const { employee, user } = await seedHrOnlyEmployee("B", 5);
    createdEmployeeIds.push(employee.id);
    createdUserEmails.push(user.email);

    const leave = await createPendingClLeave(employee.id, user, 2, `${CODE_PREFIX} B`);

    const [r1, r2] = await Promise.all([
      runWorker({
        op: "approve",
        leaveId: leave.id,
        expectedVersion: leave.version,
        actor: hrActor,
      }),
      runWorker({
        op: "approve",
        leaveId: leave.id,
        expectedVersion: leave.version,
        actor: hrActor,
      }),
    ]);

    const snap = await snapshot(employee.id, [leave.id]);

    console.info("[Scenario B]", {
      r1,
      r2,
      leave: snap.leaves[0],
      deductions: snap.deductions,
      clBalance: snap.balance.clBalance,
      steps: snap.steps,
    });

    expect(snap.leaves[0]?.workflowStatus).toBe(LeaveWorkflowStatus.approved);
    expect(snap.deductions).toHaveLength(1);
    expect(snap.deductedDays).toBe(2);
    expect(snap.balance.clBalance).toBe(3);
    expect(snap.steps.every((s) => s.status === ApprovalStepStatus.approved)).toBe(true);

    const successes = [r1, r2].filter((r) => r.ok);
    expect(successes).toHaveLength(1);
    expect([r1, r2].some((r) => !r.ok)).toBe(true);
  });

  run("Scenario C — duplicate approval retry after success", async () => {
    const { employee, user } = await seedHrOnlyEmployee("C", 4);
    createdEmployeeIds.push(employee.id);
    createdUserEmails.push(user.email);

    const leave = await createPendingClLeave(employee.id, user, 1, `${CODE_PREFIX} C`);

    const first = await runWorker({
      op: "approve",
      leaveId: leave.id,
      expectedVersion: leave.version,
      actor: hrActor,
    });
    expect(first.ok).toBe(true);

    const afterFirst = await snapshot(employee.id, [leave.id]);
    expect(afterFirst.deductions).toHaveLength(1);
    expect(afterFirst.balance.clBalance).toBe(3);

    const retry = await runWorker({
      op: "approve",
      leaveId: leave.id,
      expectedVersion: leave.version, // stale version on purpose
      actor: hrActor,
    });
    expect(retry.ok).toBe(false);

    const snap = await snapshot(employee.id, [leave.id]);
    expect(snap.leaves[0]?.workflowStatus).toBe(LeaveWorkflowStatus.approved);
    expect(snap.deductions).toHaveLength(1);
    expect(snap.balance.clBalance).toBe(3);
  });

  run("Scenario D — concurrent approve vs cancel (separate connections)", async () => {
    const { employee, user } = await seedHrOnlyEmployee("D", 3);
    createdEmployeeIds.push(employee.id);
    createdUserEmails.push(user.email);

    const leave = await createPendingClLeave(employee.id, user, 1, `${CODE_PREFIX} D`);

    const [approveRes, cancelRes] = await Promise.all([
      runWorker({
        op: "approve",
        leaveId: leave.id,
        expectedVersion: leave.version,
        actor: hrActor,
      }),
      runWorker({
        op: "cancel",
        leaveId: leave.id,
        reason: "Concurrency cancel race test reason",
        actor: hrActor,
      }),
    ]);

    const snap = await snapshot(employee.id, [leave.id]);
    const status = snap.leaves[0]?.workflowStatus;

    console.info("[Scenario D]", {
      approveRes,
      cancelRes,
      status,
      deductions: snap.deductions,
      txs: snap.txs.filter((t) => t.leaveRequestId === leave.id),
      clBalance: snap.balance.clBalance,
    });

    expect([
      LeaveWorkflowStatus.approved,
      LeaveWorkflowStatus.cancelled,
      LeaveWorkflowStatus.pending_approval,
    ]).toContain(status);

    // Never overspend; never more than one deduction for this request.
    expect(snap.deductions.filter((d) => d.leaveRequestId === leave.id)).toHaveLength(
      status === LeaveWorkflowStatus.pending_approval ? 0 : 1
    );
    expect(snap.balance.clBalance).toBeGreaterThanOrEqual(0);

    if (status === LeaveWorkflowStatus.approved) {
      expect(snap.balance.clBalance).toBe(2);
      expect(approveRes.ok).toBe(true);
      expect(cancelRes.ok).toBe(false);
    } else if (status === LeaveWorkflowStatus.cancelled) {
      // Approve then cancel, or cancel after approve committed — net restore.
      const linked = snap.txs.filter((t) => t.leaveRequestId === leave.id);
      const deductions = linked.filter((t) => t.transactionType === "deduction");
      const restores = linked.filter((t) => t.transactionType === "accrual");
      expect(deductions.length).toBeLessThanOrEqual(1);
      if (deductions.length === 1) {
        expect(restores).toHaveLength(1);
        expect(snap.balance.clBalance).toBe(3);
      }
    }
  });

  run("Scenario E — concurrent accrual path + approval (separate connections)", async () => {
    // Fresh employee with ZERO pre-seeded yearly accruals so accrual is due.
    const employee = await prisma.employee.create({
      data: {
        employeeCode: `${CODE_PREFIX}E`,
        name: "Concurrency E",
        joiningDate: new Date(), // not EL-eligible → only CL/SL yearly
        employeeStatus: "Active",
        isActive: true,
      },
    });
    createdEmployeeIds.push(employee.id);

    await prisma.employeeLeaveBalance.create({
      data: { employeeId: employee.id, elBalance: 0, clBalance: 0, slBalance: 0 },
    });

    const user = await prisma.user.create({
      data: {
        email: `${CODE_PREFIX.toLowerCase()}-e@test.local`,
        role: UserRole.employee,
        employeeId: employee.id,
      },
    });
    createdUserEmails.push(user.email);

    // Give enough CL via manual adjustment so approval can succeed after accrual,
    // without pre-creating the yearly accrual reason keys.
    await prisma.leaveTransaction.create({
      data: {
        employeeId: employee.id,
        leaveType: "CL",
        transactionType: "manual_adjustment",
        amount: 2,
        reason: "concurrency-test seed",
        createdBy: "concurrency-test",
      },
    });
    await prisma.employeeLeaveBalance.update({
      where: { employeeId: employee.id },
      data: { clBalance: 2 },
    });

    const leave = await createPendingClLeave(employee.id, user, 1, `${CODE_PREFIX} E`);

    const [approveRes, accrueRes] = await Promise.all([
      runWorker({
        op: "approve",
        leaveId: leave.id,
        expectedVersion: leave.version,
        actor: hrActor,
      }),
      runWorker({
        op: "accrue",
        employeeId: employee.id,
      }),
    ]);

    const snap = await snapshot(employee.id, [leave.id]);
    const clYearly = snap.systemAccruals.filter(
      (t) => t.reason === `CL yearly allocation ${YEAR}`
    );
    const slYearly = snap.systemAccruals.filter(
      (t) => t.reason === `SL yearly allocation ${YEAR}`
    );

    console.info("[Scenario E]", {
      approveRes,
      accrueRes,
      clYearlyCount: clYearly.length,
      slYearlyCount: slYearly.length,
      deductions: snap.deductions,
      clBalance: snap.balance.clBalance,
      status: snap.leaves[0]?.workflowStatus,
    });

    expect(approveRes.ok || accrueRes.ok).toBe(true);
    expect(snap.deductions.filter((d) => d.leaveRequestId === leave.id).length).toBeLessThanOrEqual(
      1
    );
    expect(snap.balance.clBalance).toBeGreaterThanOrEqual(0);
    // migration 20260826070000_leave_transaction_idempotency_fix now enforces
    // this at the DB level (leave_transactions_system_accrual_reason_uidx) —
    // no more tolerating duplicates here.
    expect(clYearly).toHaveLength(1);
    expect(slYearly).toHaveLength(1);
  });
});
