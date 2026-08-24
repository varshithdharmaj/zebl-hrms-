import "server-only";

import { NotificationChannel, NotificationType } from "@/generated/prisma/enums";
import { enqueueNotification } from "@/lib/notifications/notification-queue";
import { getHrRecipients } from "@/lib/notifications/recipient-resolver";
import { logger } from "@/lib/observability/logger";

function failureReason(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return "unknown";
}

/** Queued only, after commit — never blocks/rolls back the submission transaction. */
export async function queueRegularizationSubmittedAlert(input: {
  requestId: number;
  employeeName: string;
  attendanceDateLabel: string;
}): Promise<void> {
  try {
    const recipients = await getHrRecipients();
    await Promise.all(
      recipients.map((recipient) =>
        enqueueNotification({
          type: NotificationType.attendance_regularization_submitted,
          channel: NotificationChannel.email,
          recipient: recipient.email,
          subject: `Attendance regularisation request — ${input.employeeName}`,
          payload: {
            message: `${input.employeeName} submitted an attendance regularisation request for ${input.attendanceDateLabel}.`,
            employeeName: input.employeeName,
            attendanceDate: input.attendanceDateLabel,
          },
          correlationId: `attendance-regularization-submitted-${input.requestId}-${recipient.email}`,
          userId: recipient.userId,
        })
      )
    );
  } catch (error) {
    logger.warn("attendance.regularization.submitted_alert_failed", {
      entityType: "attendance_regularization_request",
      entityId: String(input.requestId),
      reason: failureReason(error),
    });
  }
}

/** Queued only, after commit — approve/reject decision notice to the employee. */
export async function queueRegularizationDecisionNotice(input: {
  requestId: number;
  employeeEmail: string | null;
  attendanceDateLabel: string;
  approved: boolean;
  reviewComment: string | null;
}): Promise<void> {
  if (!input.employeeEmail) return;
  try {
    await enqueueNotification({
      type: input.approved
        ? NotificationType.attendance_regularization_approved
        : NotificationType.attendance_regularization_rejected,
      channel: NotificationChannel.email,
      recipient: input.employeeEmail,
      subject: `Attendance regularisation ${input.approved ? "approved" : "rejected"} — ${input.attendanceDateLabel}`,
      payload: {
        message: input.approved
          ? `Your attendance regularisation request for ${input.attendanceDateLabel} has been approved.`
          : `Your attendance regularisation request for ${input.attendanceDateLabel} was rejected.${input.reviewComment ? ` Reason: ${input.reviewComment}` : ""}`,
        attendanceDate: input.attendanceDateLabel,
        reviewComment: input.reviewComment ?? undefined,
      },
      correlationId: `attendance-regularization-decision-${input.requestId}`,
    });
  } catch (error) {
    logger.warn("attendance.regularization.decision_notice_failed", {
      entityType: "attendance_regularization_request",
      entityId: String(input.requestId),
      reason: failureReason(error),
    });
  }
}
