import { NextResponse } from "next/server";
import { authorizeCronOrAdmin, getCronSecrets } from "@/lib/auth/cron-auth";
import { runElAccrualBatch } from "@/lib/leave/el-accrual-engine";
import { runManagedWorkerOnce } from "@/lib/workers/worker-manager";

/**
 * EL accrual is anchored to the leave cycle's 26th, but this endpoint is
 * safe to trigger daily (or more often) — idempotency is DB-enforced via
 * the (employeeId, cycleKey) unique index, so a scheduler outage that
 * delays a run past the 26th simply catches up on the next call rather
 * than losing an accrual.
 */
export async function POST(request: Request) {
  const { leaveElAccrual } = getCronSecrets();
  if (!(await authorizeCronOrAdmin(request, [leaveElAccrual]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runManagedWorkerOnce({
    name: "leave-el-accrual",
    runOnce: async () => runElAccrualBatch() as Promise<Record<string, unknown>>,
  });
  return NextResponse.json(result);
}
