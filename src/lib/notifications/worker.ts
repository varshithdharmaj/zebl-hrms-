import { prisma } from "@/lib/prisma";
import {
  claimDueNotificationIds,
  releaseStuckNotifications,
} from "@/lib/db/queue-lock";
import {
  markNotificationFailed,
  markNotificationSent,
} from "@/lib/notifications/notification-queue";
import { dispatchNotification } from "@/lib/notifications/notification-dispatcher";
import { MAX_NOTIFICATION_ATTEMPTS, WORKER_BATCH_SIZE } from "@/lib/notifications/notification-types";
import { logger } from "@/lib/observability/logger";

export type ProcessQueueResult = {
  processed: number;
  sent: number;
  failed: number;
  released: number;
};

export async function processNotificationQueue(opts?: {
  limit?: number;
  workerId?: string;
}): Promise<ProcessQueueResult> {
  const limit = opts?.limit ?? WORKER_BATCH_SIZE;
  const workerId = opts?.workerId ?? `notifications-${process.pid}`;

  const released = await releaseStuckNotifications();
  if (released > 0) {
    logger.warn("Released stuck notifications", { worker: workerId, released });
  }

  const ids = await claimDueNotificationIds(limit, workerId, MAX_NOTIFICATION_ATTEMPTS);
  let sent = 0;
  let failed = 0;

  for (const id of ids) {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) continue;

    const result = await dispatchNotification(notification);

    if (result.success) {
      await markNotificationSent(notification.id, result.providerMessageId);
      sent += 1;
    } else {
      await markNotificationFailed(
        notification.id,
        result.error ?? "Unknown delivery error",
        notification.attempts
      );
      failed += 1;
    }
  }

  return { processed: ids.length, sent, failed, released };
}
