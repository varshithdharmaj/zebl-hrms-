import { NotificationDeliveryStatus } from "@/generated/prisma/enums";
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
  const groups = await prisma.notification.groupBy({
    by: ["status"],
    _count: { id: true },
    where: {
      status: {
        in: [
          NotificationDeliveryStatus.pending,
          NotificationDeliveryStatus.failed,
          NotificationDeliveryStatus.sent,
        ],
      },
    },
  });

  return {
    pending: groups.find((g) => g.status === NotificationDeliveryStatus.pending)?._count.id ?? 0,
    failed: groups.find((g) => g.status === NotificationDeliveryStatus.failed)?._count.id ?? 0,
    sent: groups.find((g) => g.status === NotificationDeliveryStatus.sent)?._count.id ?? 0,
  };
}
