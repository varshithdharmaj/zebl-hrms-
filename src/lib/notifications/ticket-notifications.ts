import { NotificationChannel, NotificationType, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { enqueueNotification } from "@/lib/notifications/notification-queue";
import { sanitizeEmail } from "@/lib/notifications/sanitize";
import type { ResolvedRecipient } from "@/lib/notifications/recipient-resolver";

/**
 * Get Super Admin recipients (for anonymous tickets).
 */
export async function getSuperAdminRecipients(): Promise<ResolvedRecipient[]> {
  const users = await prisma.user.findMany({
    where: {
      role: UserRole.super_admin,
      isActive: true,
    },
    select: { id: true, email: true, employee: { select: { name: true } } },
  });
  return users.map((u) => ({
    email: u.email,
    userId: u.id,
    name: u.employee?.name,
    role: "super_admin",
  }));
}

/**
 * Get HR recipients for normal (non-anonymous) tickets.
 */
export async function getHrRecipientsForTickets(): Promise<ResolvedRecipient[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.super_admin, UserRole.hr] },
      isActive: true,
    },
    select: { id: true, email: true, employee: { select: { name: true } } },
  });
  return users.map((u) => ({
    email: u.email,
    userId: u.id,
    name: u.employee?.name,
  }));
}

/**
 * Get the employee who raised a ticket.
 */
export async function getTicketRaiserRecipient(
  employeeId: number
): Promise<ResolvedRecipient | null> {
  const user = await prisma.user.findFirst({
    where: { employeeId },
    select: { id: true, email: true, employee: { select: { name: true } } },
  });
  if (!user) {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { email: true, name: true },
    });
    const email = emp?.email ? sanitizeEmail(emp.email) : null;
    if (!email) return null;
    return { email, name: emp?.name };
  }
  return {
    email: user.email,
    userId: user.id,
    name: user.employee?.name,
  };
}

/**
 * Get the assigned handler for a ticket.
 */
export async function getTicketHandlerRecipient(
  userId: string
): Promise<ResolvedRecipient | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, employee: { select: { name: true } } },
  });
  if (!user) return null;
  return {
    email: user.email,
    userId: user.id,
    name: user.employee?.name,
  };
}

/**
 * Notify employee when ticket is created.
 */
export async function notifyTicketCreated(ticketId: string, isAnonymous: boolean): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      subject: true,
      raisedByEmployeeId: true,
      isAnonymous: true,
    },
  });

  if (!ticket) return;

  // Notify employee
  const employee = await getTicketRaiserRecipient(ticket.raisedByEmployeeId);
  if (employee) {
    await enqueueNotification({
      type: NotificationType.ticket_created,
      channel: NotificationChannel.email,
      recipient: employee.email,
      subject: `Ticket ${ticket.ticketNumber} created`,
      payload: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
      },
      correlationId: ticketId,
    });
  }

  // Notify HR for normal tickets, SA for anonymous
  if (isAnonymous) {
    const superAdmins = await getSuperAdminRecipients();
    for (const sa of superAdmins) {
      await enqueueNotification({
        type: NotificationType.ticket_anonymous_created,
        channel: NotificationChannel.email,
        recipient: sa.email,
        subject: "Anonymous ticket received (Super Admin Only)",
        payload: {
          ticketNumber: ticket.ticketNumber,
          message: "A new anonymous ticket requires Super Admin attention.",
        },
        correlationId: ticketId,
      });
    }
  } else {
    // Notify HR for normal tickets
    const hrUsers = await getHrRecipientsForTickets();
    for (const hr of hrUsers) {
      await enqueueNotification({
        type: NotificationType.ticket_created,
        channel: NotificationChannel.email,
        recipient: hr.email,
        subject: `New ticket: ${ticket.subject}`,
        payload: {
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
        },
        correlationId: ticketId,
      });
    }
  }
}

/**
 * Notify when ticket is assigned.
 */
export async function notifyTicketAssigned(
  ticketId: string,
  assignedToUserId: string
): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      subject: true,
      isAnonymous: true,
    },
  });

  if (!ticket) return;

  const handler = await getTicketHandlerRecipient(assignedToUserId);
  if (!handler) return;

  await enqueueNotification({
    type: NotificationType.ticket_assigned,
    channel: NotificationChannel.email,
    recipient: handler.email,
    subject: `Ticket ${ticket.ticketNumber} assigned to you`,
    payload: {
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      isAnonymous: ticket.isAnonymous,
    },
    correlationId: ticketId,
  });
}

/**
 * Notify employee when HR adds a public update.
 */
export async function notifyTicketUpdated(
  ticketId: string,
  visibility: string
): Promise<void> {
  // Only notify for public updates, not internal notes
  if (visibility !== "public_update") return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      subject: true,
      raisedByEmployeeId: true,
      isAnonymous: true,
    },
  });

  if (!ticket) return;

  // Notify employee
  const employee = await getTicketRaiserRecipient(ticket.raisedByEmployeeId);
  if (employee) {
    await enqueueNotification({
      type: NotificationType.ticket_updated,
      channel: NotificationChannel.email,
      recipient: employee.email,
      subject: `Update on ticket ${ticket.ticketNumber}`,
      payload: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
      },
      correlationId: ticketId,
    });
  }

  // Notify SA for anonymous ticket updates
  if (ticket.isAnonymous) {
    const superAdmins = await getSuperAdminRecipients();
    for (const sa of superAdmins) {
      await enqueueNotification({
        type: NotificationType.ticket_anonymous_updated,
        channel: NotificationChannel.email,
        recipient: sa.email,
        subject: "Anonymous ticket updated (Super Admin Only)",
        payload: {
          ticketNumber: ticket.ticketNumber,
          message: "Anonymous ticket has been updated.",
        },
        correlationId: ticketId,
      });
    }
  }
}

/**
 * Notify handler when employee replies.
 */
export async function notifyEmployeeReplied(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      subject: true,
      assignedToUserId: true,
      isAnonymous: true,
    },
  });

  if (!ticket) return;

  // Notify assigned handler if exists
  if (ticket.assignedToUserId) {
    const handler = await getTicketHandlerRecipient(ticket.assignedToUserId);
    if (handler) {
      await enqueueNotification({
        type: NotificationType.ticket_employee_replied,
        channel: NotificationChannel.email,
        recipient: handler.email,
        subject: `Employee replied to ticket ${ticket.ticketNumber}`,
        payload: {
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
        },
        correlationId: ticketId,
      });
    }
  } else {
    // Unassigned ticket - notify HR pool (or SA for anonymous)
    if (ticket.isAnonymous) {
      const superAdmins = await getSuperAdminRecipients();
      for (const sa of superAdmins) {
        await enqueueNotification({
          type: NotificationType.ticket_anonymous_updated,
          channel: NotificationChannel.email,
          recipient: sa.email,
          subject: "Anonymous ticket reply (Super Admin Only)",
          payload: {
            ticketNumber: ticket.ticketNumber,
            message: "Employee replied to anonymous ticket.",
          },
          correlationId: ticketId,
        });
      }
    } else {
      const hrUsers = await getHrRecipientsForTickets();
      for (const hr of hrUsers) {
        await enqueueNotification({
          type: NotificationType.ticket_employee_replied,
          channel: NotificationChannel.email,
          recipient: hr.email,
          subject: `Employee replied to unassigned ticket ${ticket.ticketNumber}`,
          payload: {
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
          },
          correlationId: ticketId,
        });
      }
    }
  }
}

/**
 * Notify employee when ticket status changes.
 */
export async function notifyTicketStatusChanged(
  ticketId: string,
  newStatus: string
): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      subject: true,
      raisedByEmployeeId: true,
    },
  });

  if (!ticket) return;

  const employee = await getTicketRaiserRecipient(ticket.raisedByEmployeeId);
  if (employee) {
    await enqueueNotification({
      type: NotificationType.ticket_status_changed,
      channel: NotificationChannel.email,
      recipient: employee.email,
      subject: `Ticket ${ticket.ticketNumber} status changed`,
      payload: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        newStatus,
      },
      correlationId: ticketId,
    });
  }
}

/**
 * Notify employee when ticket is resolved.
 */
export async function notifyTicketResolved(ticketId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      subject: true,
      raisedByEmployeeId: true,
      resolutionNotes: true,
    },
  });

  if (!ticket) return;

  const employee = await getTicketRaiserRecipient(ticket.raisedByEmployeeId);
  if (employee) {
    await enqueueNotification({
      type: NotificationType.ticket_resolved,
      channel: NotificationChannel.email,
      recipient: employee.email,
      subject: `Ticket ${ticket.ticketNumber} resolved`,
      payload: {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        resolutionNotes: ticket.resolutionNotes,
      },
      correlationId: ticketId,
    });
  }
}
