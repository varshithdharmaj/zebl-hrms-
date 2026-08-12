/**
 * Child-process worker: own Node process ⇒ own Prisma client / connection pool.
 * Reads one JSON payload from stdin; writes one JSON result line to stdout.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

function loadEnvFile(path: string) {
  try {
    const text = readFileSync(path, "utf8");
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

// Prefer direct (session) connection for concurrent transactions when available.
if (process.env.DIRECT_URL?.trim()) {
  process.env.DATABASE_URL = process.env.DIRECT_URL.trim();
}

type Payload =
  | {
      op: "approve";
      leaveId: number;
      expectedVersion: number;
      actor: {
        id: string;
        email: string;
        role: "employee" | "hr" | "super_admin";
        employeeId: number | null;
      };
    }
  | {
      op: "cancel";
      leaveId: number;
      reason: string;
      actor: {
        id: string;
        email: string;
        role: "employee" | "hr" | "super_admin";
        employeeId: number | null;
      };
    }
  | {
      op: "accrue";
      employeeId: number;
    };

async function main() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let raw = "";
  for await (const line of rl) raw += line;
  const payload = JSON.parse(raw) as Payload;

  // Defer app imports until env is ready.
  const { advanceWorkflow, cancelWorkflow, toWorkflowActor, WorkflowError } =
    await import("@/lib/workflow/leave-workflow");
  const { processPendingLeaveAccruals } = await import("@/lib/leave");
  const { prisma } = await import("@/lib/prisma");

  try {
    if (payload.op === "approve") {
      const result = await advanceWorkflow(
        payload.leaveId,
        toWorkflowActor(payload.actor),
        payload.expectedVersion
      );
      process.stdout.write(
        JSON.stringify({
          ok: true,
          op: "approve",
          leaveId: payload.leaveId,
          workflowStatus: result.workflowStatus,
          message: result.message,
        }) + "\n"
      );
    } else if (payload.op === "cancel") {
      const result = await cancelWorkflow(
        payload.leaveId,
        toWorkflowActor(payload.actor),
        payload.reason
      );
      process.stdout.write(
        JSON.stringify({
          ok: true,
          op: "cancel",
          leaveId: payload.leaveId,
          workflowStatus: result.workflowStatus,
          message: result.message,
        }) + "\n"
      );
    } else {
      await processPendingLeaveAccruals(payload.employeeId);
      process.stdout.write(
        JSON.stringify({ ok: true, op: "accrue", employeeId: payload.employeeId }) + "\n"
      );
    }
  } catch (error) {
    const message =
      error instanceof WorkflowError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    process.stdout.write(
      JSON.stringify({
        ok: false,
        op: payload.op,
        error: message,
        name: error instanceof Error ? error.name : "Error",
      }) + "\n"
    );
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      op: "boot",
      error: error instanceof Error ? error.message : String(error),
    }) + "\n"
  );
  process.exit(1);
});
