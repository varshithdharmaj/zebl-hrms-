"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WidgetCard } from "@/components/ui/widget-card";
import { formatDate } from "@/lib/utils";
import { Search, AlertCircle } from "lucide-react";

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

type HRUser = {
  id: string;
  email: string;
  employee: { name: string } | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  attendance: "Attendance",
  leave: "Leave",
  payroll: "Payroll",
  salary: "Salary",
  it_technical: "IT/Technical",
  hr: "HR",
  workplace: "Workplace",
  facilities: "Facilities",
  suggestion: "Suggestion",
  other: "Other",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-rose-100 text-rose-800",
};

export function HRTicketManagement({
  tickets,
  stats,
  priorityStats,
  hrUsers,
  initialFilters,
  pagination,
}: {
  tickets: Ticket[];
  stats: Stats;
  priorityStats: PriorityStats;
  hrUsers: HRUser[];
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
  const [search, setSearch] = useState(initialFilters.search);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || "all");
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.category || "all");
  const [priorityFilter, setPriorityFilter] = useState(initialFilters.priority || "all");

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams();
    if (statusFilter !== "all" && key !== "status") params.set("status", statusFilter);
    if (categoryFilter !== "all" && key !== "category") params.set("category", categoryFilter);
    if (priorityFilter !== "all" && key !== "priority") params.set("priority", priorityFilter);
    if (search && key !== "search") params.set("q", search);

    if (value !== "all") {
      params.set(key, value);
    }

    router.push(`/admin/tickets${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (value) params.set("q", value);
    router.push(`/admin/tickets${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const totalCount = stats.reduce((sum, s) => sum + s._count, 0);
  const getStatusCount = (status: string) =>
    stats.find((s) => s.status === status)?._count || 0;
  const getPriorityCount = (priority: string) =>
    priorityStats.find((p) => p.priority === priority)?._count || 0;

  return (
    <div className="space-y-6">
      {/* Dashboard Stats */}
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

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={(e) => handleSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(search)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <div className="w-40">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                handleFilterChange("status", v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting_for_employee">Waiting</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                handleFilterChange("category", v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select
              value={priorityFilter}
              onValueChange={(v) => {
                setPriorityFilter(v);
                handleFilterChange("priority", v);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Ticket Table */}
      {tickets.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No tickets found matching your filters.
        </p>
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
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                  {CATEGORY_LABELS[ticket.category] || ticket.category}
                </span>
              </DataTableCell>
              <DataTableCell>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                    PRIORITY_COLORS[ticket.priority] || "bg-slate-100 text-slate-700"
                  }`}
                >
                  {ticket.priority}
                </span>
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
                <StatusBadge status={ticket.status.replace(/_/g, " ")} />
              </DataTableCell>
              <DataTableCell className="whitespace-nowrap text-xs text-slate-600">
                {formatDate(ticket.updatedAt)}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {pagination.page > 1 && (
            <Link
              href={`/admin/tickets?${new URLSearchParams({ 
                ...(statusFilter !== "all" && { status: statusFilter }),
                ...(categoryFilter !== "all" && { category: categoryFilter }),
                ...(priorityFilter !== "all" && { priority: priorityFilter }),
                ...(search && { q: search }),
                page: String(pagination.page - 1),
              }).toString()}`}
              className="px-4 py-2 text-sm bg-background border rounded-md hover:bg-muted"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2 text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          {pagination.page < pagination.totalPages && (
            <Link
              href={`/admin/tickets?${new URLSearchParams({ 
                ...(statusFilter !== "all" && { status: statusFilter }),
                ...(categoryFilter !== "all" && { category: categoryFilter }),
                ...(priorityFilter !== "all" && { priority: priorityFilter }),
                ...(search && { q: search }),
                page: String(pagination.page + 1),
              }).toString()}`}
              className="px-4 py-2 text-sm bg-background border rounded-md hover:bg-muted"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
