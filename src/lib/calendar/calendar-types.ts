import type { CalendarSyncStatus } from "@prisma/client";

export type { CalendarSyncStatus };

export type CalendarSyncOperation = "create" | "update" | "delete";

export type CalendarSyncResult = {
  success: boolean;
  operation: CalendarSyncOperation;
  externalEventId?: string;
  status: CalendarSyncStatus;
  error?: string;
};

export type LeaveCalendarContext = {
  leaveRequestId: number;
  employeeEmail: string;
  employeeName: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  externalEventId?: string | null;
};
