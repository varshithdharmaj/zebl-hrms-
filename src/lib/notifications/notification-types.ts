import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
} from "@prisma/client";

export type { NotificationChannel, NotificationDeliveryStatus, NotificationType };

export const MAX_NOTIFICATION_ATTEMPTS = 5;
export const WORKER_BATCH_SIZE = 20;

export type LeaveEmailPayload = {
  leaveRequestId: number;
  employeeName: string;
  employeeCode: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  workflowStatus: string;
  rejectionReason?: string;
  approverName?: string;
  viewUrl: string;
  approveLink?: string;
  rejectLink?: string;
  approvalLinkExpiresAt?: string;
};

export type NotificationPayload = LeaveEmailPayload & Record<string, unknown>;

export type EnqueueNotificationInput = {
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  payload: NotificationPayload;
  correlationId?: string;
  scheduledAt?: Date;
  userId?: string;
};

export type ChannelDeliveryResult = {
  success: boolean;
  providerMessageId?: string;
  error?: string;
};

export function parseNotificationPayload(raw: string): NotificationPayload {
  try {
    return JSON.parse(raw) as NotificationPayload;
  } catch {
    return {
      leaveRequestId: 0,
      employeeName: "",
      employeeCode: "",
      leaveType: "",
      startDate: "",
      endDate: "",
      days: 0,
      reason: "",
      workflowStatus: "",
      viewUrl: "",
    };
  }
}

export interface NotificationChannelHandler {
  readonly channel: NotificationChannel;
  send(
    notification: {
      id: string;
      type: NotificationType;
      recipient: string;
      subject: string;
      payload: string;
    }
  ): Promise<ChannelDeliveryResult>;
}
