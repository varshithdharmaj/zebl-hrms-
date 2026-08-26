import { CalendarSyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { isGraphConfigured } from "@/lib/microsoft/graph-auth";
import {
  createUserCalendarEvent,
  deleteUserCalendarEvent,
  updateUserCalendarEvent,
} from "@/lib/microsoft/graph-calendar";
import { mapLeaveToGraphEvent } from "@/lib/calendar/calendar-mapper";
import type { CalendarSyncResult, LeaveCalendarContext } from "@/lib/calendar/calendar-types";
import { getIntegrationSettings } from "@/lib/integrations/integration-settings";

async function resolveLeaveContext(leaveRequestId: number): Promise<LeaveCalendarContext | null> {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: { employee: { include: { user: true } } },
  });
  if (!leave) return null;

  const email =
    leave.employee.user?.email ??
    leave.employee.email;
  if (!email) return null;

  return {
    leaveRequestId: leave.id,
    employeeEmail: email,
    employeeName: leave.employee.name,
    leaveType: leave.leaveType,
    startDate: leave.startDate,
    endDate: leave.endDate,
    days: leave.days,
    reason: leave.reason,
    externalEventId: leave.externalCalendarEventId,
  };
}

async function updateLeaveCalendarState(
  leaveRequestId: number,
  data: {
    externalCalendarEventId?: string | null;
    calendarSyncStatus: CalendarSyncStatus;
    error?: string;
  }
) {
  await prisma.leaveRequest.update({
    where: { id: leaveRequestId },
    data: {
      externalCalendarEventId: data.externalCalendarEventId ?? undefined,
      calendarSyncStatus: data.calendarSyncStatus,
      calendarLastSyncedAt: new Date(),
    },
  });

  await writeAuditLog({
    entityType: "leave_request",
    entityId: String(leaveRequestId),
    action:
      data.calendarSyncStatus === CalendarSyncStatus.synced
        ? AUDIT_ACTIONS.CALENDAR_SYNC_SUCCESS
        : data.calendarSyncStatus === CalendarSyncStatus.deleted
          ? AUDIT_ACTIONS.CALENDAR_SYNC_DELETED
          : AUDIT_ACTIONS.CALENDAR_SYNC_FAILED,
    metadata: {
      status: data.calendarSyncStatus,
      externalEventId: data.externalCalendarEventId,
      error: data.error,
    },
  });
}

export async function syncApprovedLeaveToCalendar(
  leaveRequestId: number,
  correlationId?: string
): Promise<CalendarSyncResult> {
  const settings = await getIntegrationSettings();
  if (!settings.calendarSyncEnabled || !isGraphConfigured()) {
    await updateLeaveCalendarState(leaveRequestId, {
      calendarSyncStatus: CalendarSyncStatus.skipped,
    });
    return { success: true, operation: "create", status: CalendarSyncStatus.skipped };
  }

  const ctx = await resolveLeaveContext(leaveRequestId);
  if (!ctx) {
    await updateLeaveCalendarState(leaveRequestId, {
      calendarSyncStatus: CalendarSyncStatus.failed,
      error: "No employee email for calendar sync",
    });
    return {
      success: false,
      operation: "create",
      status: CalendarSyncStatus.failed,
      error: "No employee email",
    };
  }

  const event = mapLeaveToGraphEvent(ctx);

  if (ctx.externalEventId) {
    const updated = await updateUserCalendarEvent(
      ctx.employeeEmail,
      ctx.externalEventId,
      event,
      correlationId
    );
    if (!updated.ok) {
      const err = updated.error;
      await updateLeaveCalendarState(leaveRequestId, {
        calendarSyncStatus: CalendarSyncStatus.failed,
        error: err,
      });
      return {
        success: false,
        operation: "update",
        status: CalendarSyncStatus.failed,
        error: err,
      };
    }
    await updateLeaveCalendarState(leaveRequestId, {
      externalCalendarEventId: ctx.externalEventId,
      calendarSyncStatus: CalendarSyncStatus.synced,
    });
    return {
      success: true,
      operation: "update",
      status: CalendarSyncStatus.synced,
      externalEventId: ctx.externalEventId,
    };
  }

  const created = await createUserCalendarEvent(ctx.employeeEmail, event, correlationId);
  if (!created.ok || !created.data?.id) {
    const err = !created.ok ? created.error : "No event id returned";
    await updateLeaveCalendarState(leaveRequestId, {
      calendarSyncStatus: CalendarSyncStatus.failed,
      error: err,
    });
    return {
      success: false,
      operation: "create",
      status: CalendarSyncStatus.failed,
      error: err,
    };
  }

  await updateLeaveCalendarState(leaveRequestId, {
    externalCalendarEventId: created.data.id,
    calendarSyncStatus: CalendarSyncStatus.synced,
  });

  return {
    success: true,
    operation: "create",
    status: CalendarSyncStatus.synced,
    externalEventId: created.data.id,
  };
}

export async function removeLeaveFromCalendar(
  leaveRequestId: number,
  correlationId?: string
): Promise<CalendarSyncResult> {
  const ctx = await resolveLeaveContext(leaveRequestId);
  if (!ctx?.externalEventId) {
    await updateLeaveCalendarState(leaveRequestId, {
      calendarSyncStatus: CalendarSyncStatus.skipped,
      externalCalendarEventId: null,
    });
    return { success: true, operation: "delete", status: CalendarSyncStatus.skipped };
  }

  const deleted = await deleteUserCalendarEvent(
    ctx.employeeEmail,
    ctx.externalEventId,
    correlationId
  );

  if (!deleted.ok && deleted.status !== 404) {
    await updateLeaveCalendarState(leaveRequestId, {
      calendarSyncStatus: CalendarSyncStatus.failed,
      error: deleted.error,
    });
    return {
      success: false,
      operation: "delete",
      status: CalendarSyncStatus.failed,
      error: deleted.error,
    };
  }

  await updateLeaveCalendarState(leaveRequestId, {
    externalCalendarEventId: null,
    calendarSyncStatus: CalendarSyncStatus.deleted,
  });

  return { success: true, operation: "delete", status: CalendarSyncStatus.deleted };
}
