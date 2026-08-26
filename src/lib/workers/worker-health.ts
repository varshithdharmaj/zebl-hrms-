import { WorkerRunStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const STALE_HEARTBEAT_MS = 5 * 60 * 1000;

export async function recordWorkerHeartbeat(params: {
  workerName: string;
  status: WorkerRunStatus;
  lastResult?: Record<string, unknown>;
  lastError?: string;
  durationMs?: number;
}): Promise<void> {
  const now = new Date();
  await prisma.workerHeartbeat.upsert({
    where: { workerName: params.workerName },
    create: {
      workerName: params.workerName,
      status: params.status,
      lastBeatAt: now,
      lastRunAt: params.status === "running" ? now : undefined,
      lastResult: params.lastResult ? JSON.stringify(params.lastResult) : null,
      lastError: params.lastError?.slice(0, 2000) ?? null,
      lastDurationMs: params.durationMs ?? null,
      runsTotal: params.status === "idle" ? 1 : 0,
    },
    update: {
      status: params.status,
      lastBeatAt: now,
      ...(params.status === "running" ? { lastRunAt: now } : {}),
      ...(params.lastResult
        ? { lastResult: JSON.stringify(params.lastResult) }
        : {}),
      ...(params.lastError !== undefined
        ? { lastError: params.lastError?.slice(0, 2000) ?? null }
        : {}),
      ...(params.durationMs !== undefined ? { lastDurationMs: params.durationMs } : {}),
      ...(params.status === "idle" ? { runsTotal: { increment: 1 } } : {}),
    },
  });
}

export async function markWorkerStopped(workerName: string): Promise<void> {
  await prisma.workerHeartbeat.updateMany({
    where: { workerName },
    data: { status: WorkerRunStatus.stopped, lastBeatAt: new Date() },
  });
}

export async function getWorkerHealthSummary() {
  const workers = await prisma.workerHeartbeat.findMany({
    orderBy: { workerName: "asc" },
  });
  const now = Date.now();
  return workers.map((w: (typeof workers)[number]) => ({
    workerName: w.workerName,
    status: w.status,
    lastBeatAt: w.lastBeatAt,
    lastRunAt: w.lastRunAt,
    lastDurationMs: w.lastDurationMs,
    lastError: w.lastError,
    lastResult: w.lastResult,
    runsTotal: w.runsTotal,
    stale: now - w.lastBeatAt.getTime() > STALE_HEARTBEAT_MS,
  }));
}

export function isWorkerStale(lastBeatAt: Date): boolean {
  return Date.now() - lastBeatAt.getTime() > STALE_HEARTBEAT_MS;
}
