import { NotificationDeliveryStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { getPendingApprovalsForActor } from "@/lib/workflow/pending-approvals";

export type NotificationCenterItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  severity: "info" | "warning" | "danger";
  createdAt: Date;
};

export async function getNotificationCenterItems(
  session: SessionUser
): Promise<NotificationCenterItem[]> {
  const items: NotificationCenterItem[] = [];

  // Pending approvals are scoped by getPendingApprovalsForActor: HR queue for admins,
  // hierarchy-assigned steps for line-managers (empty for everyone else).
  const pending = await getPendingApprovalsForActor(session);
  if (pending.length > 0) {
    items.push({
      id: "pending-approvals",
      title: `${pending.length} leave approval(s)`,
      description: "Awaiting your decision",
      href: canAccessAdmin(session.role) ? "/admin/leaves" : "/employee/approvals",
      severity: "warning",
      createdAt: new Date(),
    });
  }

  if (canAccessAdmin(session.role)) {
    const groups = await prisma.notification.groupBy({
      by: ["status"],
      _count: { id: true },
      where: {
        status: {
          in: [NotificationDeliveryStatus.failed, NotificationDeliveryStatus.pending],
        },
      },
    });

    const failed = groups.find((g) => g.status === NotificationDeliveryStatus.failed)?._count.id ?? 0;
    const queue = groups.find((g) => g.status === NotificationDeliveryStatus.pending)?._count.id ?? 0;

    if (failed > 0) {
      items.push({
        id: "failed-notifications",
        title: `${failed} failed notification(s)`,
        description: "Delivery dead-letter queue",
        href: "/admin/notifications",
        severity: "danger",
        createdAt: new Date(),
      });
    }
    if (queue > 20) {
      items.push({
        id: "notification-backlog",
        title: `${queue} queued notifications`,
        description: "Consider running the notification worker",
        href: "/admin/operations",
        severity: "info",
        createdAt: new Date(),
      });
    }
  }

  return items;
}
