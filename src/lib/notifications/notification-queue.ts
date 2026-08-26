import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import {
  MAX_NOTIFICATION_ATTEMPTS,
  WORKER_BATCH_SIZE,
  type EnqueueNotificationInput,
} from "@/lib/notifications/notification-types";

const rateLimitStore = new Map<string, number>();

function rateLimitKey(type: NotificationType, recipient: string, correlationId?: string) {
  return `${type}:${recipient}:${correlationId ?? "none"}`;
}

export function checkNotificationRateLimit(
  type: NotificationType,
  recipient: string,
  correlationId?: string,
  windowMs = 60_000
): boolean {
  const key = rateLimitKey(type, recipient, correlationId);
  const now = Date.now();
  const last = rateLimitStore.get(key);
  if (last && now - last < windowMs) return false;
  rateLimitStore.set(key, now);
  return true;
}

export async function enqueueNotification(
  input: EnqueueNotificationInput
): Promise<string | null> {
  if (!checkNotificationRateLimit(input.type, input.recipient, input.correlationId)) {
    return null;
  }

  const row = await prisma.notification.create({
    data: {
      type: input.type,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject,
      payload: JSON.stringify(input.payload),
      status: NotificationDeliveryStatus.pending,
      correlationId: input.correlationId ?? null,
      scheduledAt: input.scheduledAt ?? new Date(),
    },
  });

  await writeAuditLog({
    entityType: "notification",
    entityId: row.id,
    action: AUDIT_ACTIONS.NOTIFICATION_QUEUED,
    metadata: {
      type: input.type,
      channel: input.channel,
      recipient: input.recipient,
      correlationId: input.correlationId,
    },
  });

  return row.id;
}

export async function fetchDueNotifications(limit = WORKER_BATCH_SIZE) {
  const now = new Date();
  return prisma.notification.findMany({
    where: {
      status: NotificationDeliveryStatus.pending,
      scheduledAt: { lte: now },
      attempts: { lt: MAX_NOTIFICATION_ATTEMPTS },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
}

export async function markNotificationProcessing(id: string): Promise<boolean> {
  const updated = await prisma.notification.updateMany({
    where: {
      id,
      status: NotificationDeliveryStatus.pending,
    },
    data: {
      status: NotificationDeliveryStatus.processing,
      updatedAt: new Date(),
    },
  });
  return updated.count > 0;
}

export async function markNotificationSent(
  id: string,
  providerMessageId?: string
): Promise<void> {
  await prisma.notification.update({
    where: { id },
    data: {
      status: NotificationDeliveryStatus.sent,
      sentAt: new Date(),
      lastError: null,
      lockedAt: null,
      lockedBy: null,
    },
  });

  await writeAuditLog({
    entityType: "notification",
    entityId: id,
    action: AUDIT_ACTIONS.NOTIFICATION_SENT,
    metadata: { providerMessageId },
  });
}

export async function markNotificationFailed(
  id: string,
  error: string,
  attempts: number
): Promise<void> {
  const nextAttempts = attempts + 1;
  const isDeadLetter = nextAttempts >= MAX_NOTIFICATION_ATTEMPTS;
  const backoffMs = Math.min(2 ** nextAttempts * 60_000, 3_600_000);

  await prisma.notification.update({
    where: { id },
    data: {
      status: isDeadLetter
        ? NotificationDeliveryStatus.failed
        : NotificationDeliveryStatus.pending,
      attempts: nextAttempts,
      lastError: error.slice(0, 2000),
      scheduledAt: isDeadLetter ? undefined : new Date(Date.now() + backoffMs),
      lockedAt: null,
      lockedBy: null,
    },
  });

  await writeAuditLog({
    entityType: "notification",
    entityId: id,
    action: isDeadLetter
      ? AUDIT_ACTIONS.NOTIFICATION_FAILED
      : AUDIT_ACTIONS.NOTIFICATION_RETRIED,
    metadata: {
      error: error.slice(0, 500),
      attempts: nextAttempts,
      deadLetter: isDeadLetter,
      nextRetryAt: isDeadLetter ? null : new Date(Date.now() + backoffMs).toISOString(),
    },
  });
}

export async function resetNotificationForRetry(id: string): Promise<void> {
  await prisma.notification.update({
    where: { id },
    data: {
      status: NotificationDeliveryStatus.pending,
      scheduledAt: new Date(),
      lastError: null,
    },
  });

  await writeAuditLog({
    entityType: "notification",
    entityId: id,
    action: AUDIT_ACTIONS.NOTIFICATION_RETRIED,
    metadata: { manual: true },
  });
}

export async function getUserPreferences(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function shouldSendToUser(
  userId: string | undefined,
  opts: {
    approvalAlert?: boolean;
    statusAlert?: boolean;
    channel: NotificationChannel;
  }
): Promise<boolean> {
  if (!userId) return true;
  const prefs = await getUserPreferences(userId);
  if (opts.channel === NotificationChannel.email && !prefs.emailEnabled) return false;
  if (opts.channel === NotificationChannel.teams) {
    const teamsEnabled = prefs.teamsNotificationsEnabled ?? prefs.futureTeamsEnabled;
    if (!teamsEnabled) return false;
    if (opts.approvalAlert && !prefs.teamsApprovalCardsEnabled) return false;
  }
  if (opts.approvalAlert && !prefs.leaveApprovalAlerts) return false;
  if (opts.statusAlert && !prefs.leaveStatusAlerts) return false;
  return true;
}
