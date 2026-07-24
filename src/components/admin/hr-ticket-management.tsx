"use client";

import { useRouter } from "next/navigation";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { WidgetCard } from "@/components/ui/widget-card";
import { TicketListFilters } from "@/components/tickets/ticket-list-filters";
import {
  TicketCategoryBadge,
  TicketPriorityBadge,
  TicketStatusCell,
} from "@/components/tickets/ticket-list-badges";
import { TicketListPagination } from "@/components/tickets/ticket-list-pagination";
import { TicketListEmpty } from "@/components/tickets/ticket-list-empty";
import { useTicketListFilters } from "@/hooks/use-ticket-list-filters";
import { formatDate } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

const HR_TICKETS_BASE = "/admin/tickets";

const HR_STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_employee", label: "Waiting" },
  { value: "on_hold", label: "On Hold" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  isAnonymous: boolean;
  department: string | null;
  assignedToUserId: string | null;
  assignedToUser: {
    id: string;
    email: string;
    employee: { name: string } | null;
  } | null;
  raisedByEmployee: {
    name: string;
    employeeCode: string;
  };
  updatedAt: Date;
  createdAt: Date;
};

type Stats = { status: string; _count: number }[];
type PriorityStats = { priority: string; _count: number }[];

export function HRTicketManagement({
  tickets,
  stats,
  priorityStats,
  initialFilters,
  pagination,
}: {
  tickets: Ticket[];
  stats: Stats;
  priorityStats: PriorityStats;
  initialFilters: {
    status: string;
    category: string;
    priority: string;
    search: string;
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}) {
  const router = useRouter();
  const { filters, onSearchInputChange, onSearchCommit, onSelectChange } =
    useTicketListFilters(HR_TICKETS_BASE, initialFilters);

  const totalCount = stats.reduce((sum, s) => sum + s._count, 0);
  const getStatusCount = (status: string) =>
    stats.find((s) => s.status === status)?._count || 0;
  const getPriorityCount = (priority: string) =>
    priorityStats.find((p) => p.priority === priority)?._count || 0;

  return (
    <div className="space-y-6">
      {/* Dashboard Stats — HR-specific */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <WidgetCard title="Total Tickets">
          <p className="text-2xl font-bold">{totalCount}</p>
        </WidgetCard>
        <WidgetCard title="New">
          <p className="text-2xl font-bold">{getStatusCount("new")}</p>
        </WidgetCard>
        <WidgetCard title="Open">
          <p className="text-2xl font-bold">{getStatusCount("open")}</p>
        </WidgetCard>
        <WidgetCard title="In Progress">
          <p className="text-2xl font-bold">{getStatusCount("in_progress")}</p>
        </WidgetCard>
        <WidgetCard title="Waiting">
          <p className="text-2xl font-bold">{getStatusCount("waiting_for_employee")}</p>
        </WidgetCard>
        <WidgetCard title="On Hold">
          <p className="text-2xl font-bold">{getStatusCount("on_hold")}</p>
        </WidgetCard>
        <WidgetCard title="Resolved">
          <p className="text-2xl font-bold">{getStatusCount("resolved")}</p>
        </WidgetCard>
        <WidgetCard title="High Priority">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <p className="text-2xl font-bold">{getPriorityCount("high")}</p>
          </div>
        </WidgetCard>
      </div>

      <TicketListFilters
        filters={filters}
        searchPlaceholder="Search tickets..."
        statusOptions={HR_STATUS_OPTIONS}
        onSearchInputChange={onSearchInputChange}
        onSearchCommit={onSearchCommit}
        onSelectChange={onSelectChange}
      />

      {tickets.length === 0 ? (
        <TicketListEmpty message="No tickets found matching your filters." />
      ) : (
        <DataTable
          columns={[
            "Ticket",
            "Subject",
            "Employee",
            "Category",
            "Priority",
            "Assigned To",
            "Status",
            "Updated",
          ]}
        >
          {tickets.map((ticket) => (
            <DataTableRow
              key={ticket.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
            >
              <DataTableCell>
                <span className="font-mono text-xs font-semibold text-slate-900">
                  {ticket.ticketNumber}
                </span>
              </DataTableCell>
              <DataTableCell className="max-w-xs">
                <p className="truncate font-medium text-slate-900">{ticket.subject}</p>
              </DataTableCell>
              <DataTableCell>
                <p className="font-medium text-slate-900">{ticket.raisedByEmployee.name}</p>
                <p className="text-xs text-slate-500">{ticket.raisedByEmployee.employeeCode}</p>
              </DataTableCell>
              <DataTableCell>
                <TicketCategoryBadge category={ticket.category} />
              </DataTableCell>
              <DataTableCell>
                <TicketPriorityBadge priority={ticket.priority} />
              </DataTableCell>
              <DataTableCell>
                {ticket.assignedToUser ? (
                  <p className="text-sm text-slate-700">
                    {ticket.assignedToUser.employee?.name || ticket.assignedToUser.email}
                  </p>
                ) : (
                  <span className="text-xs text-muted-foreground">Unassigned</span>
                )}
              </DataTableCell>
              <DataTableCell>
                <TicketStatusCell status={ticket.status} />
              </DataTableCell>
              <DataTableCell className="whitespace-nowrap text-xs text-slate-600">
                {formatDate(ticket.updatedAt)}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      {pagination && (
        <TicketListPagination
          basePath={HR_TICKETS_BASE}
          filters={filters}
          pagination={pagination}
        />
      )}
    </div>
  );
}
