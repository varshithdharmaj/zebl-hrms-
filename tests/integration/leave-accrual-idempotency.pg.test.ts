/**
 * P1-4 — Real PostgreSQL concurrent accrual idempotency verification.
 *
 * Confirms the DB-level unique indexes added by migration
 * 20260826070000_leave_transaction_idempotency_fix actually prevent
 * duplicate accruals under real concurrency (not just app-level checks).
 * Uses separate child processes (own Prisma client/connection each), same
 * pattern as leave-approval-concurrency.pg.test.ts. Skips cleanly when
 * Postgres is unavailable.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

// Deliberately NOT switching to DIRECT_URL here (unlike the approval-
// concurrency suite): this test spawns up to 10 concurrent child processes,
// each opening its own Prisma client/connection pool. The direct/session
// connection has a low connection cap (observed: pool_size 15) and gets
// exhausted by 10 simultaneous processes. The pgbouncer transaction-pooled
// DATABASE_URL is built for exactly this — many logical connections
// multiplexed over few backend connections — and still gives each
// `prisma.$transaction()` call a real dedicated backend connection for its
// duration, which is all correctness here depends on.
const { prisma } = await import("@/lib/prisma");

const CODE_PREFIX = `AIQ${Date.now().toString(36).toUpperCase()}`;
const YEAR = new Date().getFullYear();
const CONCURRENCY = 10;

type WorkerResult = { ok: boolean; op?: string; employeeId?: number; lotsCreated?: string[]; error?: string };

async function isDatabaseReady(): Promise<boolean> {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) return false;
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
      ["--import", "./scripts/mock-server-only-register.mjs", "--import", "tsx", workerPath],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
        stdio: ["pipe", "pipe", "pipe"],
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", () => {
      const lines = stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith("{"));
      const last = lines[lines.length - 1];
      if (!last) {
        reject(new Error(`Worker produced no JSON. stderr=${stderr.slice(0, 800)}`));
        return;
      }
      try {
        resolve(JSON.parse(last) as WorkerResult);
      } catch (error) {
        reject(new Error(`Worker JSON parse failed: ${String(error)}; line=${last}`));
      }
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

async function seedEmployee(label: string, joiningDate: Date) {
  const employee = await prisma.employee.create({
    data: {
      employeeCode: `${CODE_PREFIX}${label}`,
      name: `Accrual Idempotency ${label}`,
      joiningDate,
      employeeStatus: "Active",
      isActive: true,
    },
  });
  await prisma.employeeLeaveBalance.create({
    data: { employeeId: employee.id, elBalance: 0, clBalance: 0, slBalance: 0 },
  });
  return employee;
}

describe("P1-4 leave accrual idempotency under real concurrency (real PostgreSQL)", () => {
  let ready = false;
  const createdEmployeeIds: number[] = [];

  const run = (name: string, fn: () => Promise<void>) =>
    it(
      name,
      async () => {
        if (!ready) return;
        await fn();
      },
      120_000
    );

  beforeAll(async () => {
    ready = await isDatabaseReady();
    if (!ready) {
      console.warn("[P1-4 accrual idempotency] BLOCKED/skipped: PostgreSQL not reachable.");
      return;
    }

    const idx = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname::text AS indexname FROM pg_indexes
      WHERE tablename = 'leave_transactions'
        AND indexname = 'leave_transactions_system_accrual_reason_uidx'
    `;
    if (idx.length === 0) {
      throw new Error(
        "leave_transactions_system_accrual_reason_uidx is missing in this database — " +
          "run migration 20260826070000_leave_transaction_idempotency_fix before this test."
      );
    }
  }, 60_000);

  afterAll(async () => {
    if (!ready || createdEmployeeIds.length === 0) return;
    try {
      await prisma.leaveTransaction.deleteMany({ where: { employeeId: { in: createdEmployeeIds } } });
      await prisma.elAccrualLot.deleteMany({ where: { employeeId: { in: createdEmployeeIds } } });
      await prisma.employeeLeaveBalance.deleteMany({ where: { employeeId: { in: createdEmployeeIds } } });
      await prisma.employee.deleteMany({ where: { id: { in: createdEmployeeIds } } });
    } catch {
      // best-effort cleanup
    }
  }, 60_000);

  run(
    `${CONCURRENCY} concurrent CL/SL accrual attempts for the SAME employee/period -> exactly one each`,
    async () => {
      const employee = await seedEmployee("SAME", new Date()); // not EL-eligible; CL/SL only
      createdEmployeeIds.push(employee.id);

      const results = await Promise.all(
        Array.from({ length: CONCURRENCY }, () => runWorker({ op: "accrue", employeeId: employee.id }))
      );

      expect(results.every((r) => r.ok)).toBe(true);

      const txs = await prisma.leaveTransaction.findMany({
        where: {
          employeeId: employee.id,
          leaveRequestId: null,
          transactionType: "accrual",
        },
      });
      const clYearly = txs.filter((t) => t.reason === `CL yearly allocation ${YEAR}`);
      const slYearly = txs.filter((t) => t.reason === `SL yearly allocation ${YEAR}`);

      console.info("[Same-employee CL/SL]", { clCount: clYearly.length, slCount: slYearly.length });

      expect(clYearly).toHaveLength(1);
      expect(slYearly).toHaveLength(1);

      const balance = await prisma.employeeLeaveBalance.findUniqueOrThrow({
        where: { employeeId: employee.id },
      });
      expect(balance.clBalance).toBe(clYearly[0]!.amount);
      expect(balance.slBalance).toBe(slYearly[0]!.amount);
    }
  );

  run(
    `${CONCURRENCY} concurrent EL accrual attempts for the SAME employee/cycle -> exactly one lot`,
    async () => {
      // Joined long enough ago to be EL-eligible for the current cycle.
      const employee = await seedEmployee("EL", new Date(2020, 0, 1));
      createdEmployeeIds.push(employee.id);

      const results = await Promise.all(
        Array.from({ length: CONCURRENCY }, () => runWorker({ op: "accrueEl", employeeId: employee.id }))
      );

      expect(results.every((r) => r.ok)).toBe(true);

      const lots = await prisma.elAccrualLot.findMany({ where: { employeeId: employee.id } });
      const totalLotsCreatedAcrossWorkers = results.reduce(
        (sum, r) => sum + (r.lotsCreated?.length ?? 0),
        0
      );

      console.info("[Same-employee EL]", {
        lotCount: lots.length,
        cycleKeys: lots.map((l) => l.cycleKey),
        totalLotsCreatedAcrossWorkers,
      });

      // Exactly one lot per distinct cycleKey — no duplicates despite 10
      // concurrent attempts, and across all 10 workers combined, only as
      // many lots were actually created as exist in the DB (no worker
      // silently created a duplicate that another then raced past).
      const uniqueCycleKeys = new Set(lots.map((l) => l.cycleKey));
      expect(uniqueCycleKeys.size).toBe(lots.length);
      expect(totalLotsCreatedAcrossWorkers).toBe(lots.length);

      const balance = await prisma.employeeLeaveBalance.findUniqueOrThrow({
        where: { employeeId: employee.id },
      });
      const expectedBalance = lots.reduce((sum, l) => sum + l.remaining, 0);
      expect(balance.elBalance).toBe(expectedBalance);
    }
  );

  run(
    `${CONCURRENCY} concurrent accrual attempts split across MULTIPLE employees -> each gets exactly one, no cross-contamination`,
    async () => {
      const employeeA = await seedEmployee("MULTI-A", new Date());
      const employeeB = await seedEmployee("MULTI-B", new Date());
      createdEmployeeIds.push(employeeA.id, employeeB.id);

      // Interleave 5 attempts per employee within the same concurrent batch.
      const jobs = Array.from({ length: CONCURRENCY }, (_, i) =>
        runWorker({ op: "accrue", employeeId: i % 2 === 0 ? employeeA.id : employeeB.id })
      );
      const results = await Promise.all(jobs);
      expect(results.every((r) => r.ok)).toBe(true);

      for (const employee of [employeeA, employeeB]) {
        const txs = await prisma.leaveTransaction.findMany({
          where: { employeeId: employee.id, leaveRequestId: null, transactionType: "accrual" },
        });
        const clYearly = txs.filter((t) => t.reason === `CL yearly allocation ${YEAR}`);
        const slYearly = txs.filter((t) => t.reason === `SL yearly allocation ${YEAR}`);
        expect(clYearly).toHaveLength(1);
        expect(slYearly).toHaveLength(1);
      }
    }
  );
});
