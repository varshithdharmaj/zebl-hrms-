"use client";

import { useRouter } from "next/navigation";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { WidgetCard } from "@/components/ui/widget-card";
import { TicketListFilters } from "@/components/tickets/ticket-list-filters";
import {
  TicketCategoryBadge,
  TicketPriorityBadge,
  TicketStatusCell,
} from "@/components/tickets/ticket-list-badges";
import { TicketListEmpty } from "@/components/tickets/ticket-list-empty";
import { useTicketListFilters } from "@/hooks/use-ticket-list-filters";
import { formatDate } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";

const ANONYMOUS_TICKETS_BASE = "/admin/tickets/anonymous";

const ANONYMOUS_STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
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
    id: number;
    name: string;
    employeeCode: string;
  };
  updatedAt: Date;
  createdAt: Date;
};

type Stats = { status: string; _count: number }[];

export function SuperAdminAnonymousTickets({
  tickets,
  stats,
  initialFilters,
}: {
  tickets: Ticket[];
  stats: Stats;
  initialFilters: {
    status: string;
    category: string;
    priority: string;
    search: string;
  };
}) {
  const router = useRouter();
  const { filters, onSearchInputChange, onSearchCommit, onSelectChange } =
    useTicketListFilters(ANONYMOUS_TICKETS_BASE, initialFilters);

  const totalCount = stats.reduce((sum, s) => sum + s._count, 0);
  const getStatusCount = (status: string) =>
    stats.find((s) => s.status === status)?._count || 0;

  return (
    <div className="space-y-6">
      {/* Security Warning — Superadmin anonymous queue only */}
      <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <ShieldAlert className="h-5 w-5 flex-shrink-0 text-rose-600" />
        <div>
          <p className="font-semibold">Restricted Access — Super Admin Only</p>
          <p className="mt-1 text-xs text-rose-800">
            These tickets were submitted anonymously. Employee identities are visible only to Super
            Admin. Do not share this information with HR users or other staff.
          </p>
        </div>
      </div>

      {/* Dashboard Stats — anonymous-specific */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WidgetCard title="Total Anonymous">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-600" />
            <p className="text-2xl font-bold">{totalCount}</p>
          </div>
        </WidgetCard>
        <WidgetCard title="New">
          <p className="text-2xl font-bold">{getStatusCount("new")}</p>
        </WidgetCard>
        <WidgetCard title="In Progress">
          <p className="text-2xl font-bold">{getStatusCount("in_progress")}</p>
        </WidgetCard>
        <WidgetCard title="Resolved">
          <p className="text-2xl font-bold">{getStatusCount("resolved")}</p>
        </WidgetCard>
      </div>

      <TicketListFilters
        filters={filters}
        searchPlaceholder="Search anonymous tickets..."
        statusOptions={ANONYMOUS_STATUS_OPTIONS}
        onSearchInputChange={onSearchInputChange}
        onSearchCommit={onSearchCommit}
        onSelectChange={onSelectChange}
      />

      {tickets.length === 0 ? (
        <TicketListEmpty message="No anonymous tickets found matching your filters." />
      ) : (
        <DataTable
          columns={[
            "Ticket",
            "Subject",
            "Employee (Restricted)",
            "Category",
            "Priority",
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
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-semibold text-slate-900">
                    {ticket.ticketNumber}
                  </span>
                  <Badge variant="outline" className="w-fit bg-rose-50 text-xs text-rose-700">
                    Anonymous
                  </Badge>
                </div>
              </DataTableCell>
              <DataTableCell className="max-w-xs">
                <p className="truncate font-medium text-slate-900">{ticket.subject}</p>
              </DataTableCell>
              <DataTableCell>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                  <div>
                    <p className="font-medium text-slate-900">{ticket.raisedByEmployee.name}</p>
                    <p className="text-xs text-slate-500">{ticket.raisedByEmployee.employeeCode}</p>
                  </div>
                </div>
              </DataTableCell>
              <DataTableCell>
                <TicketCategoryBadge category={ticket.category} />
              </DataTableCell>
              <DataTableCell>
                <TicketPriorityBadge priority={ticket.priority} />
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
    </div>
  );
}
