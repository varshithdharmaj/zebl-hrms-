import { NotificationType } from "@/generated/prisma/enums";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import {
  buildApprovalAdaptiveCard,
  buildStatusAdaptiveCard,
  postToTeamsWebhook,
} from "@/lib/microsoft/graph-teams";
import {
  isTeamsIntegrationEnabled,
  resolveTeamsWebhookUrl,
} from "@/lib/integrations/integration-settings";
import {
  parseNotificationPayload,
  type ChannelDeliveryResult,
  type NotificationChannelHandler,
  type LeaveEmailPayload,
  type NotificationPayload,
} from "@/lib/notifications/notification-types";

function isLeavePayload(data: NotificationPayload): data is LeaveEmailPayload {
  return "leaveRequestId" in data && typeof data.leaveRequestId === "number";
}

function buildGenericTeamsCard(payload: NotificationPayload): import("@/lib/microsoft/graph-teams").TeamsMessageCard {
  const facts: { name: string; value: string }[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string" || typeof value === "number") {
      facts.push({
        name: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
        value: String(value),
      });
    }
  }

  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: "0078D4",
    summary: "Notification",
    title: "Zebl AMS — Notification",
    sections: [{ facts }],
  };
}

function cardForType(type: NotificationType, payload: NotificationPayload) {
  if (!isLeavePayload(payload)) {
    // For non-leave notifications (like tickets), return a generic card
    return buildGenericTeamsCard(payload);
  }

  switch (type) {
    case NotificationType.approval_required:
    case NotificationType.escalation_reminder:
      return buildApprovalAdaptiveCard(payload);
    case NotificationType.leave_approved:
      return buildStatusAdaptiveCard(payload, "Leave approved");
    case NotificationType.leave_rejected:
      return buildStatusAdaptiveCard(payload, "Leave rejected");
    case NotificationType.leave_submitted:
      return buildStatusAdaptiveCard(payload, "Leave submitted");
    default:
      return buildStatusAdaptiveCard(payload, "Leave update");
  }
}

export const teamsChannel: NotificationChannelHandler = {
  channel: "teams",

  async send(notification): Promise<ChannelDeliveryResult> {
    const enabled = await isTeamsIntegrationEnabled();
    if (!enabled) {
      return { success: false, error: "Teams integration is disabled or not configured" };
    }

    const webhook = await resolveTeamsWebhookUrl();
    if (!webhook) {
      return { success: false, error: "Teams webhook is not configured" };
    }

    const payload = parseNotificationPayload(notification.payload);
    const card = cardForType(notification.type, payload);
    const result = await postToTeamsWebhook(webhook, card);

    await writeAuditLog({
      entityType: "notification",
      entityId: notification.id,
      action: result.success
        ? AUDIT_ACTIONS.TEAMS_NOTIFICATION_SENT
        : AUDIT_ACTIONS.TEAMS_NOTIFICATION_FAILED,
      metadata: {
        type: notification.type,
        error: result.error,
      },
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, providerMessageId: "teams-webhook" };
  },
};
