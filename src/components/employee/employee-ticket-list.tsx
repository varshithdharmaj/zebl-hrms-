"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  isAnonymous: boolean;
  updatedAt: Date;
  createdAt: Date;
  messages: { body: string; createdAt: Date }[];
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

export function EmployeeTicketList({ tickets }: { tickets: Ticket[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      search === "" ||
      t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <div className="w-40">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-40">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No tickets found matching your filters.
        </p>
      ) : (
        <DataTable
          columns={[
            "Ticket",
            "Subject",
            "Category",
            "Priority",
            "Status",
            "Latest Update",
            "Updated",
          ]}
        >
          {filtered.map((ticket) => (
            <DataTableRow
              key={ticket.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/employee/tickets/${ticket.id}`)}
            >
              <DataTableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs font-semibold text-slate-900">
                    {ticket.ticketNumber}
                  </span>
                  {ticket.isAnonymous && (
                    <Badge variant="outline" className="w-fit text-xs">
                      Anonymous
                    </Badge>
                  )}
                </div>
              </DataTableCell>
              <DataTableCell className="max-w-xs">
                <p className="truncate font-medium text-slate-900">{ticket.subject}</p>
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
                <StatusBadge status={ticket.status.replace(/_/g, " ")} />
              </DataTableCell>
              <DataTableCell className="max-w-xs">
                {ticket.messages[0] ? (
                  <p className="truncate text-xs text-slate-600">{ticket.messages[0].body}</p>
                ) : (
                  <span className="text-xs text-muted-foreground">No updates yet</span>
                )}
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
