import { NotificationChannel, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { sanitizeText } from "@/lib/notifications/sanitize";
import {
  enqueueNotification,
  shouldSendToUser,
} from "@/lib/notifications/notification-queue";
import type { LeaveEmailPayload } from "@/lib/notifications/notification-types";
import {
  mapWorkflowEventToNotificationEvent,
  type WorkflowNotificationEvent,
} from "@/lib/notifications/notification-events";
import {
  getEmployeeUserEmail,
  getHrRecipients,
  resolveCurrentStepApprover,
  resolveManagerForEmployee,
  shouldNotifyHrOnSubmit,
} from "@/lib/notifications/recipient-resolver";
import { processNotificationQueue } from "@/lib/notifications/worker";
import { createTokensForCurrentStep } from "@/lib/approval-tokens/token-generator";
import {
  getIntegrationSettings,
  isTeamsIntegrationEnabled,
  resolveTeamsWebhookUrl,
} from "@/lib/integrations/integration-settings";

import { getAppBaseUrl } from "@/lib/config/app-url";

function appBaseUrl(): string {
  return getAppBaseUrl();
}

async function buildLeavePayload(leaveRequestId: number): Promise<LeaveEmailPayload | null> {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: { employee: true },
  });
  if (!leave) return null;

  return {
    leaveRequestId: leave.id,
    employeeName: sanitizeText(leave.employee.name),
    employeeCode: leave.employee.employeeCode,
    leaveType: leave.leaveType,
    startDate: formatDate(leave.startDate),
    endDate: formatDate(leave.endDate),
    days: leave.days,
    reason: sanitizeText(leave.reason),
    workflowStatus: leave.workflowStatus,
    rejectionReason: leave.rejectionReason
      ? sanitizeText(leave.rejectionReason)
      : undefined,
    viewUrl: `${appBaseUrl()}/employee/leaves`,
  };
}

async function attachEmailApprovalLinks(
  leaveRequestId: number,
  payload: LeaveEmailPayload
): Promise<LeaveEmailPayload> {
  const links = await createTokensForCurrentStep(leaveRequestId);
  if (!links) return payload;
  return {
    ...payload,
    approveLink: links.approveUrl,
    rejectLink: links.rejectUrl,
    approvalLinkExpiresAt: links.expiresAt.toISOString(),
  };
}

async function queueTeams(
  type: NotificationType,
  subject: string,
  payload: LeaveEmailPayload,
  correlationId: string,
  userId?: string,
  opts?: { approvalAlert?: boolean; statusAlert?: boolean }
): Promise<void> {
  const enabled = await isTeamsIntegrationEnabled();
  if (!enabled) return;

  const webhook = await resolveTeamsWebhookUrl();
  if (!webhook) return;

  const settings = await getIntegrationSettings();
  if (!settings.teamsApprovalsEnabled && opts?.approvalAlert) return;

  const allowed = await shouldSendToUser(userId, {
    channel: NotificationChannel.teams,
    approvalAlert: opts?.approvalAlert,
    statusAlert: opts?.statusAlert,
  });
  if (!allowed) return;

  await enqueueNotification({
    type,
    channel: NotificationChannel.teams,
    recipient: "teams-channel",
    subject,
    payload,
    correlationId: `${correlationId}-teams`,
    userId,
  });
}

async function queueEmail(
  type: NotificationType,
  recipient: { email: string; userId?: string },
  subject: string,
  payload: LeaveEmailPayload,
  correlationId: string,
  opts: { approvalAlert?: boolean; statusAlert?: boolean }
): Promise<void> {
  const allowed = await shouldSendToUser(recipient.userId, {
    channel: NotificationChannel.email,
    approvalAlert: opts.approvalAlert,
    statusAlert: opts.statusAlert,
  });
  if (!allowed) return;

  await enqueueNotification({
    type,
    channel: NotificationChannel.email,
    recipient: recipient.email,
    subject,
    payload,
    correlationId,
    userId: recipient.userId,
  });
}

export async function handleWorkflowNotificationEvent(
  event: WorkflowNotificationEvent
): Promise<void> {
  const correlationId = `leave-${event.leaveRequestId}-${event.event}`;
  const payload = await buildLeavePayload(event.leaveRequestId);
  if (!payload) return;

  const eventName = mapWorkflowEventToNotificationEvent(event.event);

  const leaveRow = await prisma.leaveRequest.findUnique({
    where: { id: event.leaveRequestId },
    select: { employeeId: true },
  });
  if (!leaveRow) return;

  switch (eventName) {
    case "LEAVE_SUBMITTED": {
      const manager = await resolveManagerForEmployee(leaveRow.employeeId);
      if (manager) {
        payload.viewUrl = `${appBaseUrl()}/manager/approvals`;
        const withLinks = await attachEmailApprovalLinks(event.leaveRequestId, payload);
        await queueEmail(
          NotificationType.approval_required,
          manager,
          `[Zebl AMS] Approval required — ${payload.employeeName}`,
          withLinks,
          correlationId,
          { approvalAlert: true }
        );
        await queueTeams(
          NotificationType.approval_required,
          `Approval required — ${payload.employeeName}`,
          withLinks,
          correlationId,
          manager.userId,
          { approvalAlert: true }
        );
      }
      if (shouldNotifyHrOnSubmit()) {
        const hrList = await getHrRecipients();
        for (const hr of hrList) {
          payload.viewUrl = `${appBaseUrl()}/admin/leaves`;
          await queueEmail(
            NotificationType.leave_submitted,
            hr,
            `[Zebl AMS] Leave submitted — ${payload.employeeName}`,
            payload,
            `${correlationId}-hr-${hr.email}`,
            { statusAlert: true }
          );
        }
      }
      break;
    }

    case "APPROVAL_REQUIRED":
    case "STEP_APPROVED": {
      const approver = await resolveCurrentStepApprover(event.leaveRequestId);
      if (approver) {
        payload.viewUrl = `${appBaseUrl()}/manager/approvals`;
        const withLinks = await attachEmailApprovalLinks(event.leaveRequestId, payload);
        await queueEmail(
          NotificationType.approval_required,
          approver,
          `[Zebl AMS] Approval required — ${payload.employeeName}`,
          withLinks,
          `${correlationId}-approver`,
          { approvalAlert: true }
        );
        await queueTeams(
          NotificationType.approval_required,
          `Approval required — ${payload.employeeName}`,
          withLinks,
          `${correlationId}-approver`,
          approver.userId,
          { approvalAlert: true }
        );
      }
      break;
    }

    case "LEAVE_APPROVED": {
      const employee = await getEmployeeUserEmail(leaveRow.employeeId);
      if (employee) {
        payload.viewUrl = `${appBaseUrl()}/employee/leaves`;
        await queueEmail(
          NotificationType.leave_approved,
          employee,
          `[Zebl AMS] Leave approved`,
          payload,
          correlationId,
          { statusAlert: true }
        );
      }
      const hrList = await getHrRecipients();
      for (const hr of hrList) {
        payload.viewUrl = `${appBaseUrl()}/admin/leaves`;
        await queueEmail(
          NotificationType.leave_approved,
          hr,
          `[Zebl AMS] Leave approved — ${payload.employeeName}`,
          payload,
          `${correlationId}-hr`,
          { statusAlert: true }
        );
      }
      break;
    }

    case "LEAVE_REJECTED": {
      payload.rejectionReason = event.metadata?.comment
        ? sanitizeText(event.metadata.comment)
        : payload.rejectionReason;
      const employee = await getEmployeeUserEmail(leaveRow.employeeId);
      if (employee) {
        await queueEmail(
          NotificationType.leave_rejected,
          employee,
          `[Zebl AMS] Leave rejected`,
          payload,
          correlationId,
          { statusAlert: true }
        );
      }
      break;
    }

    case "LEAVE_WITHDRAWN": {
      const manager = await resolveManagerForEmployee(leaveRow.employeeId);
      if (manager) {
        await queueEmail(
          NotificationType.leave_withdrawn,
          manager,
          `[Zebl AMS] Leave withdrawn — ${payload.employeeName}`,
          payload,
          correlationId,
          { statusAlert: true }
        );
      }
      break;
    }

    case "LEAVE_CANCELLED": {
      payload.rejectionReason = event.metadata?.comment
        ? sanitizeText(String(event.metadata.comment))
        : payload.rejectionReason;
      const employee = await getEmployeeUserEmail(leaveRow.employeeId);
      if (employee) {
        await queueEmail(
          NotificationType.leave_cancelled,
          employee,
          `[Zebl AMS] Approved leave cancelled`,
          payload,
          correlationId,
          { statusAlert: true }
        );
      }
      break;
    }
  }

  void processNotificationQueue({ limit: 10 }).catch((err) => {
    console.error("[notifications] background process error:", err);
  });
}
