import { NotificationChannel, NotificationType } from "@prisma/client";
import { enqueueNotification } from "@/lib/notifications/notification-queue";
import { getHrRecipients } from "@/lib/notifications/recipient-resolver";
import type { ExecutiveDashboardPayload } from "@/lib/analytics/analytics-types";
import { getAppBaseUrl } from "@/lib/config/app-url";

export async function notifyAnalyticsAlerts(
  snapshot: ExecutiveDashboardPayload,
  correlationId: string
): Promise<void> {
  const highAnomalies = snapshot.anomalies.filter((a) => a.severity === "high");
  if (highAnomalies.length === 0 && snapshot.trends.projectedStaffingRisks.length === 0) {
    return;
  }

  const hrList = await getHrRecipients();
  const subject = `[Zebl AMS] Operational alert — ${highAnomalies.length} high-priority item(s)`;
  const payload = {
    leaveRequestId: 0,
    employeeName: "Analytics",
    employeeCode: "—",
    leaveType: "—",
    startDate: "—",
    endDate: "—",
    days: 0,
    reason: [
      ...highAnomalies.map((a) => a.title),
      ...snapshot.trends.projectedStaffingRisks,
    ].join("; "),
    workflowStatus: "analytics_alert",
    viewUrl: `${getAppBaseUrl()}/admin/analytics`,
  };

  for (const hr of hrList) {
    await enqueueNotification({
      type: NotificationType.escalation_reminder,
      channel: NotificationChannel.email,
      recipient: hr.email,
      subject,
      payload,
      correlationId: `${correlationId}-hr`,
      userId: hr.userId,
    });
  }
}
