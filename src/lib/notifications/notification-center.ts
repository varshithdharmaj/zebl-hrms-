import { NotificationDeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessAdmin, canApproveLeave } from "@/lib/permissions";
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

  if (canApproveLeave(session.role)) {
    const pending = await getPendingApprovalsForActor(session);
    if (pending.length > 0) {
      items.push({
        id: "pending-approvals",
        title: `${pending.length} leave approval(s)`,
        description: "Awaiting your decision",
        href: session.role === "manager" ? "/manager/approvals" : "/admin/leaves",
        severity: "warning",
        createdAt: new Date(),
      });
    }
  }

  if (canAccessAdmin(session.role)) {
    const [failed, queue] = await Promise.all([
      prisma.notification.count({ where: { status: NotificationDeliveryStatus.failed } }),
      prisma.notification.count({ where: { status: NotificationDeliveryStatus.pending } }),
    ]);

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
