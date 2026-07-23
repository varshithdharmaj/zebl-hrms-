import { NotificationDeliveryStatus, IntegrationJobStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getNotificationStats } from "@/lib/notifications/admin-queries";
import { getWorkerHealthSummary } from "@/lib/workers/worker-health";
import { scanWorkflowIntegrity } from "@/lib/workflow/workflow-integrity";
import { getIntegrationSettings } from "@/lib/integrations/integration-settings";

export async function getOperationsDashboard() {
  const [
    notificationStats,
    workers,
    workflowScan,
    integrationSettings,
    queueDepth,
    failedJobs,
    escalationBacklog,
  ] = await Promise.all([
    getNotificationStats(),
    getWorkerHealthSummary(),
    scanWorkflowIntegrity(),
    getIntegrationSettings(),
    prisma.notification.count({
      where: { status: NotificationDeliveryStatus.pending },
    }),
    prisma.integrationJob.findMany({
      where: { status: IntegrationJobStatus.failed },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.workflowEscalation.count({
      where: {
        sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const stuckProcessingNotifications = await prisma.notification.count({
    where: {
      status: NotificationDeliveryStatus.processing,
      lockedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
    },
  });

  const pendingIntegrationJobs = await prisma.integrationJob.count({
    where: { status: IntegrationJobStatus.pending },
  });

  return {
    notificationStats,
    workers,
    workflowIssues: workflowScan.issues.slice(0, 25),
    workflowStuckCount: workflowScan.stuckCount,
    workflowOrphanCount: workflowScan.orphanStepCount,
    integrationHealth: {
      graphStatus: integrationSettings.graphLastHealthStatus,
      graphCheckedAt: integrationSettings.graphLastHealthAt,
      calendarSyncEnabled: integrationSettings.calendarSyncEnabled,
      orgSyncEnabled: integrationSettings.orgSyncEnabled,
    },
    queueDepth,
    pendingIntegrationJobs,
    stuckProcessingNotifications,
    failedJobs: failedJobs.map((j: (typeof failedJobs)[number]) => ({
      id: j.id,
      jobType: j.jobType,
      attempts: j.attempts,
      lastError: j.lastError,
      correlationId: j.correlationId,
      createdAt: j.createdAt,
    })),
    escalationBacklog,
  };
}
