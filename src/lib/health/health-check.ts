import { NotificationDeliveryStatus, IntegrationJobStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { validateApplicationConfig } from "@/lib/config/validate";
import { getEnv } from "@/lib/config/env";
import { getWorkerHealthSummary, isWorkerStale } from "@/lib/workers/worker-health";
import { isTeamsWebhookConfiguredInEnv } from "@/lib/integrations/integration-settings";

export type HealthCheck = {
  name: string;
  status: "ok" | "warn" | "error";
  message?: string;
};

export async function checkDatabase(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { name: "database", status: "ok" };
  } catch (e) {
    return {
      name: "database",
      status: "error",
      message: e instanceof Error ? e.message : "Database unreachable",
    };
  }
}

export async function checkQueues(): Promise<HealthCheck> {
  try {
    const [pendingNotifications, failedNotifications, stuckProcessing, pendingJobs] =
      await Promise.all([
        prisma.notification.count({ where: { status: NotificationDeliveryStatus.pending } }),
        prisma.notification.count({ where: { status: NotificationDeliveryStatus.failed } }),
        prisma.notification.count({
          where: {
            status: NotificationDeliveryStatus.processing,
            lockedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
          },
        }),
        prisma.integrationJob.count({ where: { status: IntegrationJobStatus.pending } }),
      ]);

    if (stuckProcessing > 0) {
      return {
        name: "queues",
        status: "warn",
        message: `${stuckProcessing} notification(s) stuck in processing`,
      };
    }
    if (failedNotifications > 50) {
      return {
        name: "queues",
        status: "warn",
        message: `${failedNotifications} failed notifications in dead-letter`,
      };
    }

    return {
      name: "queues",
      status: "ok",
      message: `pending_notifications=${pendingNotifications}, pending_jobs=${pendingJobs}`,
    };
  } catch (e) {
    return {
      name: "queues",
      status: "error",
      message: e instanceof Error ? e.message : "Queue check failed",
    };
  }
}

export async function checkWorkers(): Promise<HealthCheck> {
  const workers = await getWorkerHealthSummary();
  if (workers.length === 0) {
    return {
      name: "workers",
      status: "warn",
      message: "No worker heartbeats recorded yet",
    };
  }
  type WorkerRow = Awaited<ReturnType<typeof getWorkerHealthSummary>>[number];
  const stale = workers.filter((w: WorkerRow) => w.stale || isWorkerStale(w.lastBeatAt));
  if (stale.length > 0) {
    return {
      name: "workers",
      status: "warn",
      message: `Stale workers: ${stale.map((w: WorkerRow) => w.workerName).join(", ")}`,
    };
  }
  const errored = workers.filter((w: WorkerRow) => w.status === "error");
  if (errored.length > 0) {
    return {
      name: "workers",
      status: "warn",
      message: `Workers in error: ${errored.map((w: WorkerRow) => w.workerName).join(", ")}`,
    };
  }
  return { name: "workers", status: "ok", message: `${workers.length} worker(s) reporting` };
}

export function checkSmtpConfig(): HealthCheck {
  const host = getEnv("SMTP_HOST");
  const from = getEnv("EMAIL_FROM");
  if (!host || !from) {
    return { name: "smtp", status: "warn", message: "SMTP not fully configured" };
  }
  return { name: "smtp", status: "ok" };
}

export function checkTeamsConfig(): HealthCheck {
  if (!isTeamsWebhookConfiguredInEnv()) {
    return { name: "teams", status: "warn", message: "Teams webhook not configured" };
  }
  const url = getEnv("TEAMS_WEBHOOK_URL")!;
  if (!url.startsWith("https://")) {
    return { name: "teams", status: "warn", message: "Teams webhook should use HTTPS" };
  }
  return { name: "teams", status: "ok" };
}

export function checkAppConfig(): HealthCheck {
  const result = validateApplicationConfig({ strict: false });
  if (!result.ok) {
    return {
      name: "config",
      status: "error",
      message: result.issues
        .filter((i) => i.level === "error")
        .map((i) => i.field)
        .join(", "),
    };
  }
  const warnings = result.issues.filter((i) => i.level === "warning");
  if (warnings.length > 0) {
    return { name: "config", status: "warn", message: `${warnings.length} configuration warning(s)` };
  }
  return { name: "config", status: "ok" };
}

export async function runShallowHealth() {
  const db = await checkDatabase();
  const overall = db.status === "ok" ? "ok" : "error";
  return { status: overall, checks: [db], at: new Date().toISOString() };
}

export async function runDeepHealth() {
  const checks = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkAppConfig()),
    checkQueues(),
    checkWorkers(),
    Promise.resolve(checkSmtpConfig()),
    Promise.resolve(checkTeamsConfig()),
  ]);

  const status = checks.some((c) => c.status === "error")
    ? "error"
    : checks.some((c) => c.status === "warn")
      ? "degraded"
      : "ok";

  return { status, checks, at: new Date().toISOString() };
}
