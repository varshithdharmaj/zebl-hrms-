"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireEmployeeSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { createTicketSchema, ticketReplySchema } from "@/lib/validation/schemas/tickets";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { canReplyToTicket } from "@/lib/tickets";
import { getSession } from "@/lib/auth";
import { PermissionError } from "@/lib/permissions";
import {
  notifyTicketCreated,
  notifyEmployeeReplied,
} from "@/lib/notifications/ticket-notifications";
import {
  checkTicketCreationRateLimit,
  getRateLimitResetTime,
} from "@/lib/rate-limit/ticket-rate-limit";

export type TicketActionState = {
  error?: string;
  success?: string;
  ticketId?: string;
};

/**
 * Generate a unique ticket number in format: TKT-YYYYMMDD-XXXX
 */
async function generateTicketNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  
  // Get today's ticket count
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  
  const count = await prisma.ticket.count({
    where: {
      createdAt: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
  });
  
  const sequence = String(count + 1).padStart(4, "0");
  return `TKT-${dateStr}-${sequence}`;
}

export async function createTicketAction(
  _prev: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  let session;
  try {
    session = await requireEmployeeSession();
  } catch {
    return { error: "You must be logged in as an employee to create tickets." };
  }

  const validated = safeParseWithSchema(createTicketSchema, {
    subject: formData.get("subject"),
    description: formData.get("description"),
    category: formData.get("category"),
    type: formData.get("type"),
    priority: formData.get("priority"),
    isAnonymous: formData.get("isAnonymous") === "on" || formData.get("isAnonymous") === "true",
  });

  if (!validated.ok) {
    return { error: validated.error };
  }

  const { subject, description, category, type, priority, isAnonymous } = validated.data;

  // Rate limit check
  if (!checkTicketCreationRateLimit(session.employeeId)) {
    const resetTime = getRateLimitResetTime(session.employeeId);
    return {
      error: `Rate limit exceeded. You can create another ticket in ${resetTime} seconds. Maximum ${5} tickets per minute.`,
    };
  }

  try {
    const employee = await prisma.employee.findUnique({
      where: { id: session.employeeId },
      select: { department: true },
    });

    const ticketNumber = await generateTicketNumber();

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject,
        description,
        category,
        type,
        priority,
        isAnonymous,
        raisedByEmployeeId: session.employeeId,
        department: employee?.department || null,
      },
    });

    await writeAuditLog({
      entityType: "ticket",
      entityId: ticket.id,
      action: isAnonymous ? AUDIT_ACTIONS.TICKET_CREATED_ANONYMOUS : AUDIT_ACTIONS.TICKET_CREATED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: {
        ticketNumber,
      category,
      type,
      priority,
      isAnonymous,
      raisedByEmployeeId: session.employeeId,
    },
  });

    // Send notifications (async, don't block redirect)
    notifyTicketCreated(ticket.id, isAnonymous).catch((err) => {
      console.error("[zebl] Ticket notification error:", err);
    });

    revalidatePath("/employee/tickets");
    
    // Redirect to the ticket detail page
    redirect(`/employee/tickets/${ticket.id}`);
  } catch (error) {
    // If it's a redirect, let it through
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    
    console.error("[zebl] Create ticket error:", error);
    return { error: "Failed to create ticket. Please try again." };
  }
}

export async function replyToTicketAction(
  _prev: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated" };
  }

  const validated = safeParseWithSchema(ticketReplySchema, {
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });

  if (!validated.ok) {
    return { error: validated.error };
  }

  const { ticketId, body } = validated.data;

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

    if (!ticket) {
      return { error: "Ticket not found" };
    }

    if (!canReplyToTicket(session, ticket)) {
      throw new PermissionError();
    }

    const ticketMessage = await prisma.ticketMessage.create({
      data: {
        ticketId,
        body,
        visibility: "employee_reply",
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
      action: AUDIT_ACTIONS.TICKET_EMPLOYEE_REPLY_ADDED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: {
        messageId: ticketMessage.id,
      },
    });

    // Send notification to handler
    notifyEmployeeReplied(ticketId).catch((err) => {
      console.error("[zebl] Employee reply notification error:", err);
    });

    revalidatePath(`/employee/tickets/${ticketId}`);
    revalidatePath("/employee/tickets");

    return { success: "Reply added successfully" };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { error: "You don't have permission to reply to this ticket" };
    }
    console.error("[zebl] Reply ticket error:", error);
    return { error: "Failed to add reply. Please try again." };
  }
}
