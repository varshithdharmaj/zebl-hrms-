"use client";

import { useActionState, useState } from "react";
import {
  assignTicketAction,
  changeTicketStatusAction,
  addTicketUpdateAction,
  type AdminTicketActionState,
} from "@/actions/tickets-admin";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorAlert } from "@/components/ui/error-alert";
import { formatDate } from "@/lib/utils";
import { canManageTicket, canViewInternalNotes } from "@/lib/tickets";
import { isSuperAdmin } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { Clock, User, Eye, EyeOff, History, ShieldAlert } from "lucide-react";

type TicketWithDetails = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  type: string;
  priority: string;
  status: string;
  isAnonymous: boolean;
  department: string | null;
  resolutionNotes: string | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  raisedByEmployeeId: number;
  assignedToUserId: string | null;
  raisedByEmployee: {
    id: number;
    name: string;
    employeeCode: string;
    department: string | null;
    email: string | null;
  };
  assignedToUser: {
    id: string;
    email: string;
    employee: { name: string } | null;
  } | null;
  messages: {
    id: string;
    body: string;
    visibility: string;
    createdAt: Date;
    author: {
      id: string;
      email: string;
      role: string;
      employee: { name: string } | null;
    };
  }[];
  history: {
    id: string;
    action: string;
    fieldChanged: string | null;
    oldValue: string | null;
    newValue: string | null;
    metadata: string;
    createdAt: Date;
    actor: {
      id: string;
      email: string;
      employee: { name: string } | null;
    };
  }[];
};

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

const initialState: AdminTicketActionState = {};

export function HRTicketDetail({
  ticket,
  session,
  hrUsers,
}: {
  ticket: TicketWithDetails;
  session: SessionUser;
  hrUsers: HRUser[];
}) {
  const [assignState, assignAction, assignPending] = useActionState(assignTicketAction, initialState);
  const [statusState, statusAction, statusPending] = useActionState(changeTicketStatusAction, initialState);
  const [updateState, updateAction, updatePending] = useActionState(addTicketUpdateAction, initialState);

  const [selectedAssignee, setSelectedAssignee] = useState(ticket.assignedToUserId || "");
  const [selectedStatus, setSelectedStatus] = useState(ticket.status);
  const [updateVisibility, setUpdateVisibility] = useState<"public_update" | "internal_note">("public_update");
  const [showHistory, setShowHistory] = useState(false);

  const canManage = canManageTicket(session, ticket);
  const canViewInternal = canViewInternalNotes(session, ticket);

  const isAnonymousTicket = ticket.isAnonymous;
  const isSA = isSuperAdmin(session.role);

  return (
    <div className="space-y-6">
      {/* Anonymous Warning for Super Admin */}
      {isAnonymousTicket && isSA && (
        <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold">Restricted Information — Super Admin Only</p>
            <p className="mt-1 text-xs text-rose-800">
              This is an anonymous ticket. The employee identity below is visible only to Super Admin.
              Do not share this information with HR users or other staff members.
            </p>
          </div>
        </div>
      )}

      {/* Ticket Details */}
      <SectionCard title="Ticket Information" noPadding>
        <div className="divide-y divide-border">
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Ticket Number</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {ticket.ticketNumber}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Status</p>
              <div className="mt-1">
                <StatusBadge status={ticket.status.replace(/_/g, " ")} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Category</p>
              <p className="mt-1 text-sm text-foreground">
                {CATEGORY_LABELS[ticket.category] || ticket.category}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Type</p>
              <p className="mt-1 text-sm capitalize text-foreground">{ticket.type.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Priority</p>
              <span
                className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${
                  PRIORITY_COLORS[ticket.priority] || "bg-slate-100 text-slate-700"
                }`}
              >
                {ticket.priority}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Department</p>
              <p className="mt-1 text-sm text-foreground">{ticket.department || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Created</p>
              <p className="mt-1 text-sm text-foreground">{formatDate(ticket.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Last Updated</p>
              <p className="mt-1 text-sm text-foreground">{formatDate(ticket.updatedAt)}</p>
            </div>
          </div>

          <div className={`p-6 ${isAnonymousTicket ? "bg-rose-50 border-l-4 border-l-rose-500" : ""}`}>
            <div className="flex items-center gap-2">
              {isAnonymousTicket && <ShieldAlert className="h-4 w-4 text-rose-600" />}
              <p className="text-xs font-semibold text-muted-foreground">
                {isAnonymousTicket ? "Employee (Restricted Identity — Super Admin Only)" : "Employee"}
              </p>
            </div>
            <div className="mt-1">
              <p className="font-medium text-foreground">{ticket.raisedByEmployee.name}</p>
              <p className="text-xs text-muted-foreground">
                {ticket.raisedByEmployee.employeeCode}
                {ticket.raisedByEmployee.email && ` · ${ticket.raisedByEmployee.email}`}
              </p>
              {isAnonymousTicket && (
                <p className="mt-2 text-xs font-medium text-rose-700">
                  This identity is hidden from HR users and the employee.
                </p>
              )}
            </div>
          </div>

          <div className="p-6">
            <p className="text-xs font-semibold text-muted-foreground">Subject</p>
            <p className="mt-1 text-sm font-medium text-foreground">{ticket.subject}</p>
          </div>

          <div className="p-6">
            <p className="text-xs font-semibold text-muted-foreground">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {ticket.description}
            </p>
          </div>

          {ticket.resolutionNotes && (
            <div className="bg-emerald-50 p-6">
              <p className="text-xs font-semibold text-emerald-800">Resolution Notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900 leading-relaxed">
                {ticket.resolutionNotes}
              </p>
              {ticket.resolvedAt && (
                <p className="mt-2 text-xs text-emerald-700">
                  Resolved on {formatDate(ticket.resolvedAt)}
                </p>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Management Actions */}
      {canManage && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Assignment */}
          <SectionCard title="Assignment" description="Assign ticket to an HR handler">
            <form action={assignAction} className="space-y-4">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input type="hidden" name="assignToUserId" value={selectedAssignee === "unassigned" ? "" : selectedAssignee} />
              {assignState.error && <ErrorAlert message={assignState.error} />}
              {assignState.success && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                  {assignState.success}
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Assign To</Label>
                <Select value={selectedAssignee || "unassigned"} onValueChange={setSelectedAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select handler..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {hrUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.employee?.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={assignPending} size="sm">
                {assignPending ? "Updating..." : "Update Assignment"}
              </Button>
            </form>
          </SectionCard>

          {/* Status */}
          <SectionCard title="Status" description="Change ticket status">
            <form action={statusAction} className="space-y-4">
              <input type="hidden" name="ticketId" value={ticket.id} />
              {statusState.error && <ErrorAlert message={statusState.error} />}
              {statusState.success && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                  {statusState.success}
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus} name="status">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting_for_employee">Waiting for Employee</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedStatus === "resolved" && (
                <div className="space-y-1.5">
                  <Label htmlFor="resolutionNotes" className="text-xs font-semibold text-slate-700">
                    Resolution Notes (optional)
                  </Label>
                  <Textarea
                    id="resolutionNotes"
                    name="resolutionNotes"
                    placeholder="Describe how this was resolved..."
                    rows={3}
                    maxLength={5000}
                  />
                </div>
              )}
              <Button type="submit" disabled={statusPending} size="sm">
                {statusPending ? "Updating..." : "Update Status"}
              </Button>
            </form>
          </SectionCard>
        </div>
      )}

      {/* Conversation */}
      <SectionCard
        title="Conversation"
        description={`${ticket.messages.length} ${ticket.messages.length === 1 ? "message" : "messages"}`}
      >
        <div className="space-y-4">
          {ticket.messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <div className="space-y-4">
              {ticket.messages.map((msg) => {
                const isInternal = msg.visibility === "internal_note";
                const isEmployeeReply = msg.visibility === "employee_reply";

                // Hide internal notes from non-authorized users
                if (isInternal && !canViewInternal) return null;

                return (
                  <div
                    key={msg.id}
                    className={`rounded-lg border p-4 ${
                      isEmployeeReply
                        ? "border-blue-200 bg-blue-50"
                        : isInternal
                          ? "border-amber-200 bg-amber-50"
                          : "border-border bg-card"
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs">
                      {isInternal ? (
                        <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="font-medium text-muted-foreground">
                        {msg.author.employee?.name || msg.author.email}
                        {isInternal && " (Internal)"}
                        {isEmployeeReply && " (Employee)"}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">{formatDate(msg.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                      {msg.body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {canManage && (
            <form action={updateAction} className="mt-6 space-y-4 border-t border-border pt-6">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input type="hidden" name="visibility" value={updateVisibility} />
              {updateState.error && <ErrorAlert message={updateState.error} />}
              {updateState.success && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                  {updateState.success}
                </p>
              )}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="body" className="text-xs font-semibold text-slate-700">
                    Add Update
                  </Label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setUpdateVisibility("public_update")}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        updateVisibility === "public_update"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Eye className="inline h-3 w-3 mr-1" />
                      Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpdateVisibility("internal_note")}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        updateVisibility === "internal_note"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <EyeOff className="inline h-3 w-3 mr-1" />
                      Internal
                    </button>
                  </div>
                </div>
                <Textarea
                  id="body"
                  name="body"
                  required
                  placeholder={
                    updateVisibility === "internal_note"
                      ? "Internal note (visible only to HR/SA)..."
                      : "Public update (visible to employee)..."
                  }
                  rows={4}
                  maxLength={5000}
                />
              </div>
              <Button type="submit" disabled={updatePending} size="sm">
                {updatePending ? "Sending..." : updateVisibility === "internal_note" ? "Add Internal Note" : "Send Update"}
              </Button>
            </form>
          )}
        </div>
      </SectionCard>

      {/* History */}
      <SectionCard
        title="Ticket History"
        description={`${ticket.history.length} events`}
      >
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="mb-2"
          >
            <History className="mr-2 h-4 w-4" />
            {showHistory ? "Hide History" : "Show History"}
          </Button>

          {showHistory && ticket.history.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
              {ticket.history.map((event) => (
                <div key={event.id} className="text-xs">
                  <span className="font-medium text-slate-900">
                    {event.actor.employee?.name || event.actor.email}
                  </span>
                  <span className="text-slate-600"> · {event.action} · </span>
                  <span className="text-slate-500">{formatDate(event.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
