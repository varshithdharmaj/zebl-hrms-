import { render } from "@react-email/render";
import type { NotificationType } from "@prisma/client";
import type { NotificationPayload, LeaveEmailPayload } from "@/lib/notifications/notification-types";
import { LeaveSubmittedEmail } from "@/emails/templates/leave-submitted";
import { ApprovalRequiredEmail } from "@/emails/templates/approval-required";
import { LeaveApprovedEmail } from "@/emails/templates/leave-approved";
import { LeaveRejectedEmail } from "@/emails/templates/leave-rejected";
import { LeaveWithdrawnEmail } from "@/emails/templates/leave-withdrawn";
import { LeaveCancelledEmail } from "@/emails/templates/leave-cancelled";
import { GenericNotificationEmail } from "@/emails/templates/generic-notification";

function isLeavePayload(data: NotificationPayload): data is LeaveEmailPayload {
  return "leaveRequestId" in data && typeof data.leaveRequestId === "number";
}

export async function renderNotificationEmail(
  type: NotificationType,
  data: NotificationPayload
): Promise<{ html: string; text: string }> {
  const component = pickTemplate(type, data);
  const html = await render(component);
  const text = await render(component, { plainText: true });
  return { html, text };
}

function pickTemplate(type: NotificationType, data: NotificationPayload) {
  // Leave notifications require LeaveEmailPayload
  if (isLeavePayload(data)) {
    switch (type) {
      case "leave_submitted":
        return LeaveSubmittedEmail({ data });
      case "approval_required":
        return ApprovalRequiredEmail({ data });
      case "leave_approved":
        return LeaveApprovedEmail({ data });
      case "leave_rejected":
        return LeaveRejectedEmail({ data });
      case "leave_withdrawn":
        return LeaveWithdrawnEmail({ data });
      case "leave_cancelled":
        return LeaveCancelledEmail({ data });
    }
  }
  
  // Ticket and other notifications use generic template
  return GenericNotificationEmail({ type, data });
}
