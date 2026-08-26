import { ApprovalStepStatus, LeaveWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getIntegrationSettings } from "@/lib/integrations/integration-settings";
import { enqueueNotification } from "@/lib/notifications/notification-queue";
import { NotificationChannel, NotificationType } from "@prisma/client";
import { isGraphConfigured } from "@/lib/microsoft/graph-auth";
import { getBulkPresence, isPresenceLikelyUnavailable } from "@/lib/microsoft/graph-presence";
import type { LeaveEmailPayload } from "@/lib/notifications/notification-types";
import { formatDate } from "@/lib/utils";
import { sanitizeText } from "@/lib/notifications/sanitize";
import { getAppBaseUrl } from "@/lib/config/app-url";

export async function runEscalationScan(correlationId: string): Promise<{
  escalated: number;
}> {
  const settings = await getIntegrationSettings();
  const thresholdMs = settings.escalationHours * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - thresholdMs);

  const pendingSteps = await prisma.leaveApprovalStep.findMany({
    where: {
      status: ApprovalStepStatus.pending,
      createdAt: { lt: cutoff },
      leaveRequest: { workflowStatus: LeaveWorkflowStatus.pending_approval },
    },
    include: {
      leaveRequest: { include: { employee: true } },
      approver: { include: { user: true } },
    },
    take: 50,
  });

  let escalated = 0;
  const azureIds: string[] = [];

  for (const step of pendingSteps) {
    const approverUser = step.approver?.user;
    if (approverUser?.azureOid) azureIds.push(approverUser.azureOid);
  }

  const presenceMap = new Map<string, ReturnType<typeof isPresenceLikelyUnavailable>>();
  if (isGraphConfigured() && azureIds.length > 0) {
    const presences = await getBulkPresence(azureIds);
    for (const p of presences) {
      presenceMap.set(p.id, isPresenceLikelyUnavailable(p));
    }
  }

  for (const step of pendingSteps) {
    const existing = await prisma.workflowEscalation.findUnique({
      where: {
        approvalStepId_escalationType: {
          approvalStepId: step.id,
          escalationType: "pending_timeout",
        },
      },
    });
    if (existing) continue;

    const leave = step.leaveRequest;
    const payload: LeaveEmailPayload = {
      leaveRequestId: leave.id,
      employeeName: sanitizeText(leave.employee.name),
      employeeCode: leave.employee.employeeCode,
      leaveType: leave.leaveType,
      startDate: formatDate(leave.startDate),
      endDate: formatDate(leave.endDate),
      days: leave.days,
      reason: sanitizeText(leave.reason),
      workflowStatus: leave.workflowStatus,
      viewUrl: `${getAppBaseUrl()}/manager/approvals`,
    };

    const approverUser = step.approver?.user;
    const managerOffline =
      approverUser?.azureOid && presenceMap.get(approverUser.azureOid) === true;

    if (approverUser?.email) {
      await enqueueNotification({
        type: NotificationType.escalation_reminder,
        channel: NotificationChannel.email,
        recipient: approverUser.email,
        subject: `[Zebl AMS] Escalation — approval pending ${settings.escalationHours}h+`,
        payload,
        correlationId: `${correlationId}-step-${step.id}`,
        userId: approverUser.id,
      });
    }

    const webhook = process.env.TEAMS_WEBHOOK_URL;
    if (webhook) {
      await enqueueNotification({
        type: NotificationType.escalation_reminder,
        channel: NotificationChannel.teams,
        recipient: "teams-channel",
        subject: `Escalation: ${payload.employeeName}`,
        payload,
        correlationId: `${correlationId}-teams-${step.id}`,
        userId: approverUser?.id,
      });
    }

    const hrUsers = await prisma.user.findMany({
      where: { role: { in: ["admin", "hr_admin"] } },
      select: { email: true, id: true },
    });
    for (const hr of hrUsers) {
      await enqueueNotification({
        type: NotificationType.escalation_reminder,
        channel: NotificationChannel.email,
        recipient: hr.email,
        subject: `[Zebl AMS] HR escalation — ${payload.employeeName}`,
        payload,
        correlationId: `${correlationId}-hr-${step.id}`,
        userId: hr.id,
      });
    }

    await prisma.workflowEscalation.create({
      data: {
        leaveRequestId: leave.id,
        approvalStepId: step.id,
        escalationType: managerOffline ? "manager_unavailable" : "pending_timeout",
        metadata: JSON.stringify({
          escalationHours: settings.escalationHours,
          managerOffline,
        }),
      },
    });

    await writeAuditLog({
      entityType: "leave_approval_step",
      entityId: String(step.id),
      action: AUDIT_ACTIONS.WORKFLOW_ESCALATED,
      metadata: {
        leaveRequestId: leave.id,
        escalationType: "pending_timeout",
        managerOffline,
        correlationId,
      },
    });

    escalated += 1;
  }

  return { escalated };
}
