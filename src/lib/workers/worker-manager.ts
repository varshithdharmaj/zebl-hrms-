import { WorkerRunStatus } from "@/generated/prisma/enums";
import { createCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";
import {
  markWorkerStopped,
  recordWorkerHeartbeat,
} from "@/lib/workers/worker-health";

export type WorkerRunResult = Record<string, unknown>;

export type ManagedWorkerConfig = {
  name: string;
  intervalMs?: number;
  runOnce: (correlationId: string) => Promise<WorkerRunResult>;
  onShutdown?: () => Promise<void>;
};

let shuttingDown = false;

function registerShutdownHandlers(config: ManagedWorkerConfig): void {
  const stop = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("Worker shutdown requested", { worker: config.name, signal });
    try {
      await config.onShutdown?.();
      await markWorkerStopped(config.name);
    } finally {
      process.exit(0);
    }
  };
  process.once("SIGINT", () => void stop("SIGINT"));
  process.once("SIGTERM", () => void stop("SIGTERM"));
}

export async function runManagedWorkerOnce(config: ManagedWorkerConfig): Promise<WorkerRunResult> {
  const correlationId = createCorrelationId(config.name);
  const started = Date.now();
  await recordWorkerHeartbeat({
    workerName: config.name,
    status: WorkerRunStatus.running,
  });

  try {
    const result = await config.runOnce(correlationId);
    await recordWorkerHeartbeat({
      workerName: config.name,
      status: WorkerRunStatus.idle,
      lastResult: result,
      durationMs: Date.now() - started,
    });
    logger.info("Worker run completed", { worker: config.name, correlationId, ...result });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordWorkerHeartbeat({
      workerName: config.name,
      status: WorkerRunStatus.error,
      lastError: message,
      durationMs: Date.now() - started,
    });
    logger.error("Worker run failed", { worker: config.name, correlationId, error: message });
    throw e;
  }
}

export async function runManagedWorkerLoop(config: ManagedWorkerConfig): Promise<void> {
  registerShutdownHandlers(config);
  const intervalMs = config.intervalMs ?? 30_000;
  logger.info("Worker loop started", { worker: config.name, intervalMs });

  while (!shuttingDown) {
    try {
      await runManagedWorkerOnce(config);
    } catch {
      // logged in runManagedWorkerOnce
    }
    await sleep(intervalMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runManagedWorkerCli(config: ManagedWorkerConfig): Promise<void> {
  const loop = process.env.WORKER_LOOP === "true";
  if (loop) {
    await runManagedWorkerLoop(config);
  } else {
    await runManagedWorkerOnce(config);
    await config.onShutdown?.();
    process.exit(0);
  }
}
