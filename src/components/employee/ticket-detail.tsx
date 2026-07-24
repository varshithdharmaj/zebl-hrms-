"use client";

import { useActionState } from "react";
import { replyToTicketAction, type TicketActionState } from "@/actions/tickets";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/error-alert";
import { formatDate } from "@/lib/utils";
import { canReplyToTicket } from "@/lib/tickets/ticket-permissions";
import { CATEGORY_LABELS, PRIORITY_COLORS } from "@/lib/tickets/labels";
import type { SessionUser } from "@/lib/session";
import { Clock, User } from "lucide-react";

type TicketWithMessages = {
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
  raisedByEmployee?: { id: number; name: string; employeeCode: string };
  assignedToUser?: {
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
      employee: { name: string } | null;
    };
  }[];
};

const initialState: TicketActionState = {};

export function TicketDetail({
  ticket,
  session,
}: {
  ticket: TicketWithMessages;
  session: SessionUser;
}) {
  const [state, formAction, pending] = useActionState(replyToTicketAction, initialState);
  const canReply = canReplyToTicket(session, ticket);

  return (
    <div className="space-y-6">
      <SectionCard title="Ticket Details" noPadding>
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
              <p className="text-xs font-semibold text-muted-foreground">Created</p>
              <p className="mt-1 text-sm text-foreground">{formatDate(ticket.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Last Updated</p>
              <p className="mt-1 text-sm text-foreground">{formatDate(ticket.updatedAt)}</p>
            </div>
            {ticket.isAnonymous && (
              <div className="sm:col-span-2">
                <Badge variant="outline" className="flex w-fit items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  Anonymous Ticket
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your identity is protected. Only Super Admin can view anonymous tickets.
                </p>
              </div>
            )}
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

      <SectionCard
        title="Conversation"
        description={`${ticket.messages.length} ${ticket.messages.length === 1 ? "message" : "messages"}`}
      >
        <div className="space-y-4">
          {ticket.messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No updates yet. We&apos;ll notify you when HR responds.
            </p>
          ) : (
            <div className="space-y-4">
              {ticket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg border p-4 ${
                    msg.visibility === "employee_reply"
                      ? "border-blue-200 bg-blue-50"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium">
                      {msg.visibility === "employee_reply"
                        ? "You"
                        : msg.author.employee?.name || "HR Team"}
                    </span>
                    <span>·</span>
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDate(msg.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                    {msg.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {canReply && (
            <form action={formAction} className="mt-6 space-y-4 border-t border-border pt-6">
              <input type="hidden" name="ticketId" value={ticket.id} />
              {state.error && <ErrorAlert message={state.error} />}
              {state.success && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                  {state.success}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="body" className="text-xs font-semibold text-slate-700">
                  Add a Reply
                </Label>
                <Textarea
                  id="body"
                  name="body"
                  required
                  placeholder="Type your reply..."
                  rows={4}
                  maxLength={5000}
                />
              </div>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending..." : "Send Reply"}
              </Button>
            </form>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
