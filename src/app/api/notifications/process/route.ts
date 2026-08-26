import { NextResponse } from "next/server";
import { authorizeCronOrAdmin, getCronSecrets } from "@/lib/auth/cron-auth";
import { processNotificationQueue } from "@/lib/notifications/worker";
import { runManagedWorkerOnce } from "@/lib/workers/worker-manager";

export async function POST(request: Request) {
  const { notification } = getCronSecrets();
  if (!(await authorizeCronOrAdmin(request, [notification]))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runManagedWorkerOnce({
    name: "notifications-api",
    runOnce: async () => processNotificationQueue({ limit: 50 }) as Promise<Record<string, unknown>>,
  });
  return NextResponse.json(result);
}
