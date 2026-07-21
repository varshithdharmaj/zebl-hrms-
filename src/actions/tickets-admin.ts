"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guards";
import { getSession } from "@/lib/auth";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { canManageTicket, canAssignTicket } from "@/lib/tickets";
import { PermissionError } from "@/lib/permissions";
import { z } from "zod";
import {
  notifyTicketAssigned,
  notifyTicketStatusChanged,
  notifyTicketResolved,
  notifyTicketUpdated,
} from "@/lib/notifications/ticket-notifications";

export type AdminTicketActionState = {
  error?: string;
  success?: string;
};

const assignTicketSchema = z.object({
  ticketId: z.string().min(1),
  assignToUserId: z.string().min(1).optional(),
});

const statusChangeSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum([
    "new",
    "open",
    "in_progress",
    "waiting_for_employee",
    "on_hold",
    "resolved",
    "closed",
    "canceled",
  ]),
  resolutionNotes: z.string().optional(),
});

const addUpdateSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1, "Update cannot be empty").max(5000, "Update too long"),
  visibility: z.enum(["public_update", "internal_note"]),
});

export async function assignTicketAction(
  _prev: AdminTicketActionState,
  formData: FormData
): Promise<AdminTicketActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const validated = safeParseWithSchema(assignTicketSchema, {
    ticketId: formData.get("ticketId"),
    assignToUserId: formData.get("assignToUserId") || undefined,
  });

  if (!validated.ok) return { error: validated.error };

  const { ticketId, assignToUserId } = validated.data;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        isAnonymous: true,
        raisedByEmployeeId: true,
        assignedToUserId: true,
        department: true,
      },
    });

    if (!ticket) return { error: "Ticket not found" };

    if (!canAssignTicket(session, ticket)) {
      throw new PermissionError();
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToUserId: assignToUserId || null,
        updatedAt: new Date(),
      },
    });

    await writeAuditLog({
      entityType: "ticket",
      entityId: ticketId,
      action: AUDIT_ACTIONS.TICKET_ASSIGNED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: {
        assignedToUserId: assignToUserId || null,
        previousAssignedToUserId: ticket.assignedToUserId,
      },
    });

    // Notify handler if assigned
    if (assignToUserId) {
      notifyTicketAssigned(ticketId, assignToUserId).catch((err) => {
        console.error("[zebl] Assignment notification error:", err);
      });
    }

    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath("/admin/tickets");

    return { success: assignToUserId ? "Ticket assigned successfully" : "Ticket unassigned" };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { error: "You don't have permission to assign this ticket" };
    }
    console.error("[zebl] Assign ticket error:", error);
    return { error: "Failed to assign ticket" };
  }
}

export async function changeTicketStatusAction(
  _prev: AdminTicketActionState,
  formData: FormData
): Promise<AdminTicketActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const validated = safeParseWithSchema(statusChangeSchema, {
    ticketId: formData.get("ticketId"),
    status: formData.get("status"),
    resolutionNotes: formData.get("resolutionNotes") || undefined,
  });

  if (!validated.ok) return { error: validated.error };

  const { ticketId, status, resolutionNotes } = validated.data;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        status: true,
        isAnonymous: true,
        raisedByEmployeeId: true,
        assignedToUserId: true,
        department: true,
      },
    });

    if (!ticket) return { error: "Ticket not found" };

    if (!canManageTicket(session, ticket)) {
      throw new PermissionError();
    }

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "resolved") {
      updateData.resolvedAt = new Date();
      if (resolutionNotes) {
        updateData.resolutionNotes = resolutionNotes;
      }
    }

    if (status === "closed") {
      updateData.closedAt = new Date();
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
    });

    const auditAction =
      status === "resolved"
        ? AUDIT_ACTIONS.TICKET_RESOLVED
        : status === "closed"
        ? AUDIT_ACTIONS.TICKET_CLOSED
        : status === "canceled"
        ? AUDIT_ACTIONS.TICKET_CANCELED
        : status === "open" && ticket.status === "resolved"
        ? AUDIT_ACTIONS.TICKET_REOPENED
        : AUDIT_ACTIONS.TICKET_STATUS_CHANGED;

    await writeAuditLog({
      entityType: "ticket",
      entityId: ticketId,
      action: auditAction,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: {
        oldStatus: ticket.status,
        newStatus: status,
        hasResolutionNotes: !!resolutionNotes,
      },
    });

    // Send notifications
    if (status === "resolved") {
      notifyTicketResolved(ticketId).catch((err) => {
        console.error("[zebl] Resolution notification error:", err);
      });
    } else {
      notifyTicketStatusChanged(ticketId, status).catch((err) => {
        console.error("[zebl] Status change notification error:", err);
      });
    }

    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath("/admin/tickets");
    revalidatePath(`/employee/tickets/${ticketId}`);

    return { success: "Status updated successfully" };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { error: "You don't have permission to modify this ticket" };
    }
    console.error("[zebl] Change status error:", error);
    return { error: "Failed to update status" };
  }
}

export async function addTicketUpdateAction(
  _prev: AdminTicketActionState,
  formData: FormData
): Promise<AdminTicketActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const validated = safeParseWithSchema(addUpdateSchema, {
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
    visibility: formData.get("visibility"),
  });

  if (!validated.ok) return { error: validated.error };

  const { ticketId, body, visibility } = validated.data;

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        isAnonymous: true,
        raisedByEmployeeId: true,
        assignedToUserId: true,
        department: true,
      },
    });

    if (!ticket) return { error: "Ticket not found" };

    if (!canManageTicket(session, ticket)) {
      throw new PermissionError();
    }

    const ticketMessage = await prisma.ticketMessage.create({
      data: {
        ticketId,
        body,
        visibility,
        authorUserId: session.id,
      },
    });

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date() },
    });

    await writeAuditLog({
      entityType: "ticket",
      entityId: ticketId,
      action:
        visibility === "internal_note"
          ? AUDIT_ACTIONS.TICKET_INTERNAL_NOTE_ADDED
          : AUDIT_ACTIONS.TICKET_HR_UPDATE_ADDED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: {
        visibility,
        messageId: ticketMessage.id,
      },
    });

    // Notify employee for public updates (not internal notes)
    notifyTicketUpdated(ticketId, visibility).catch((err) => {
      console.error("[zebl] Update notification error:", err);
    });

    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath("/admin/tickets");
    revalidatePath(`/employee/tickets/${ticketId}`);

    return {
      success: visibility === "internal_note" ? "Internal note added" : "Update sent to employee",
    };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { error: "You don't have permission to update this ticket" };
    }
    console.error("[zebl] Add update error:", error);
    return { error: "Failed to add update" };
  }
}
