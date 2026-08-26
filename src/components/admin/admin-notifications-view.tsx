"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  processNotificationsAction,
  retryNotificationAction,
  type NotificationActionState,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import type { Notification, NotificationDeliveryStatus } from "@prisma/client";

const initial: NotificationActionState = {};

export function AdminNotificationsView({
  notifications,
  stats,
  initialStatus,
  initialSearch,
}: {
  notifications: Notification[];
  stats: { pending: number; failed: number; sent: number };
  initialStatus?: NotificationDeliveryStatus;
  initialSearch: string;
}) {
  const [processState, processAction, processPending] = useActionState(
    async (_prev: NotificationActionState) => processNotificationsAction(),
    initial
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Failed" value={stats.failed} accent="danger" />
        <StatCard label="Sent" value={stats.sent} accent="success" />
      </div>

      <SectionCard title="Queue controls" description="Process pending notifications now">
        <form action={processAction} className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={processPending}>
            {processPending ? "Processing…" : "Process queue now"}
          </Button>
          {processState.success && (
            <p className="text-sm text-success">{processState.success}</p>
          )}
          {processState.error && <p className="text-sm text-danger">{processState.error}</p>}
        </form>
      </SectionCard>

      <SectionCard title="Filter" description="Search by recipient, subject, or correlation id">
        <form method="get" className="flex flex-wrap gap-3">
          <Input
            name="q"
            placeholder="Search…"
            defaultValue={initialSearch}
            className="max-w-xs"
          />
          <select
            name="status"
            defaultValue={initialStatus ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button type="submit" variant="outline">
            Apply
          </Button>
          <Link href="/admin/notifications" className="text-sm text-muted-foreground hover:underline">
            Clear
          </Link>
        </form>
      </SectionCard>

      <SectionCard title="Delivery log" noPadding>
        <DataTable
          columns={["Type", "Channel", "Recipient", "Subject", "Status", "Attempts", "Created", ""]}
          emptyMessage="No notifications found."
        >
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </DataTable>
      </SectionCard>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "danger" | "success";
}) {
  const color =
    accent === "danger"
      ? "text-danger"
      : accent === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  const [state, action, pending] = useActionState(retryNotificationAction, initial);

  return (
    <DataTableRow>
      <DataTableCell className="text-xs">{notification.type}</DataTableCell>
      <DataTableCell className="text-xs">{notification.channel}</DataTableCell>
      <DataTableCell className="max-w-[140px] truncate text-sm">{notification.recipient}</DataTableCell>
      <DataTableCell className="max-w-[180px] truncate text-sm">{notification.subject}</DataTableCell>
      <DataTableCell>
        <span className="text-xs font-medium capitalize">{notification.status}</span>
        {notification.lastError && (
          <p className="mt-1 max-w-[160px] truncate text-xs text-danger" title={notification.lastError}>
            {notification.lastError}
          </p>
        )}
      </DataTableCell>
      <DataTableCell className="tabular-nums text-sm">{notification.attempts}</DataTableCell>
      <DataTableCell className="text-xs text-muted-foreground">
        {formatDate(notification.createdAt)}
      </DataTableCell>
      <DataTableCell>
        {notification.status === "failed" && (
          <form action={action}>
            <input type="hidden" name="notificationId" value={notification.id} />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              Retry
            </Button>
            {state.error && <p className="text-xs text-danger">{state.error}</p>}
          </form>
        )}
      </DataTableCell>
    </DataTableRow>
  );
}
