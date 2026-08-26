import { NotificationChannel } from "@prisma/client";
import { emailChannel } from "@/lib/notifications/channels/email-channel";
import { teamsChannel } from "@/lib/notifications/channels/teams-channel";
import type {
  ChannelDeliveryResult,
  NotificationChannelHandler,
} from "@/lib/notifications/notification-types";

const channels: Partial<Record<NotificationChannel, NotificationChannelHandler>> = {
  [NotificationChannel.email]: emailChannel,
  [NotificationChannel.teams]: teamsChannel,
};

export async function dispatchNotification(notification: {
  id: string;
  type: import("@prisma/client").NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  payload: string;
}): Promise<ChannelDeliveryResult> {
  const handler = channels[notification.channel];
  if (!handler) {
    return {
      success: false,
      error: `Channel ${notification.channel} is not implemented yet`,
    };
  }
  return handler.send(notification);
}
