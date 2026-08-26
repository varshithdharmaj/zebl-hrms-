import { WorkspacePageHeader } from "@/components/layout/workspace-page-header";
import { AdminNotificationsView } from "@/components/admin/admin-notifications-view";
import {
  getNotificationsForAdmin,
  getNotificationStats,
} from "@/lib/notifications/admin-queries";
import { NotificationDeliveryStatus } from "@prisma/client";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const statusFilter =
    status && Object.values(NotificationDeliveryStatus).includes(status as NotificationDeliveryStatus)
      ? (status as NotificationDeliveryStatus)
      : undefined;

  const [notifications, stats] = await Promise.all([
    getNotificationsForAdmin({ status: statusFilter, search: q }),
    getNotificationStats(),
  ]);

  return (
    <div className="space-y-8">
      <WorkspacePageHeader
        title="Notifications"
        description="Monitor delivery queue, failures, and retry operations."
      />
      <AdminNotificationsView
        notifications={notifications}
        stats={stats}
        initialStatus={statusFilter}
        initialSearch={q ?? ""}
      />
    </div>
  );
}
