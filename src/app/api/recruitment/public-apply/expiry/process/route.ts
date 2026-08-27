import { NextResponse } from "next/server";
import { authorizeCronOrAdmin, getCronSecrets } from "@/lib/auth/cron-auth";
import { runPublicApplyExpiryBatch } from "@/lib/recruitment/public-apply/expire-submissions-batch";
import { runManagedWorkerOnce } from "@/lib/workers/worker-manager";

/**
 * Safe to run repeatedly (and frequently) — expireSubmission()'s updateMany
 * guard makes each row idempotent, and only a bounded batch is processed per
 * call, so a backlog drains over successive invocations rather than timing
 * out a single request.
 */
export async function POST(request: Request) {
  const { publicApplyExpiry } = getCronSecrets();
  if (!(await authorizeCronOrAdmin(request, [publicApplyExpiry]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runManagedWorkerOnce({
    name: "public-apply-expiry",
    runOnce: async () => runPublicApplyExpiryBatch() as Promise<Record<string, unknown>>,
  });
  return NextResponse.json(result);
}
