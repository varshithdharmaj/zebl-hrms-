import { render } from "@react-email/render";
import type { NotificationType } from "@prisma/client";
import type { LeaveEmailPayload } from "@/lib/notifications/notification-types";
import { LeaveSubmittedEmail } from "@/emails/templates/leave-submitted";
import { ApprovalRequiredEmail } from "@/emails/templates/approval-required";
import { LeaveApprovedEmail } from "@/emails/templates/leave-approved";
import { LeaveRejectedEmail } from "@/emails/templates/leave-rejected";
import { LeaveWithdrawnEmail } from "@/emails/templates/leave-withdrawn";
import { LeaveCancelledEmail } from "@/emails/templates/leave-cancelled";

export async function renderNotificationEmail(
  type: NotificationType,
  data: LeaveEmailPayload
): Promise<{ html: string; text: string }> {
  const component = pickTemplate(type, data);
  const html = await render(component);
  const text = await render(component, { plainText: true });
  return { html, text };
}

function pickTemplate(type: NotificationType, data: LeaveEmailPayload) {
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
    default:
      return LeaveSubmittedEmail({ data });
  }
}
