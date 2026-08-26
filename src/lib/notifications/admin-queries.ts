import { NotificationDeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getNotificationsForAdmin(params: {
  status?: NotificationDeliveryStatus;
  search?: string;
  limit?: number;
}) {
  const q = params.search?.trim();
  return prisma.notification.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(q
        ? {
            OR: [
              { recipient: { contains: q } },
              { subject: { contains: q } },
              { correlationId: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.limit ?? 100,
  });
}

export async function getNotificationStats() {
  const [pending, failed, sent] = await Promise.all([
    prisma.notification.count({ where: { status: NotificationDeliveryStatus.pending } }),
    prisma.notification.count({ where: { status: NotificationDeliveryStatus.failed } }),
    prisma.notification.count({
      where: { status: NotificationDeliveryStatus.sent },
    }),
  ]);
  return { pending, failed, sent };
}
