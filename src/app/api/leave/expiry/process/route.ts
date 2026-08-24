import { NextResponse } from "next/server";
import { authorizeCronOrAdmin, getCronSecrets } from "@/lib/auth/cron-auth";
import { runElExpiryBatch } from "@/lib/leave/el-expiry-engine";
import { runManagedWorkerOnce } from "@/lib/workers/worker-manager";

/** Safe to run daily — a lot with remaining=0 is excluded by the query filter, so re-running is a no-op. */
export async function POST(request: Request) {
  const { leaveElExpiry } = getCronSecrets();
  if (!(await authorizeCronOrAdmin(request, [leaveElExpiry]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runManagedWorkerOnce({
    name: "leave-el-expiry",
    runOnce: async () => runElExpiryBatch() as Promise<Record<string, unknown>>,
  });
  return NextResponse.json(result);
}
