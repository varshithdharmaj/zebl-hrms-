import type { GraphCalendarEvent } from "@/lib/microsoft/graph-types";
import type { LeaveCalendarContext } from "@/lib/calendar/calendar-types";

const TIMEZONE = process.env.CALENDAR_TIMEZONE ?? "India Standard Time";

function formatGraphDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "");
}

export function mapLeaveToGraphEvent(ctx: LeaveCalendarContext): GraphCalendarEvent {
  const endExclusive = new Date(ctx.endDate);
  endExclusive.setDate(endExclusive.getDate() + 1);

  return {
    subject: `Leave — ${ctx.leaveType} (${ctx.employeeName})`,
    body: {
      contentType: "text",
      content: `Zebl AMS leave request #${ctx.leaveRequestId}\n${ctx.reason}`,
    },
    start: { dateTime: formatGraphDateTime(ctx.startDate), timeZone: TIMEZONE },
    end: { dateTime: formatGraphDateTime(endExclusive), timeZone: TIMEZONE },
    isAllDay: true,
    showAs: "oof",
    categories: ["Zebl AMS", "Leave"],
    transactionId: `zebl-leave-${ctx.leaveRequestId}`,
  };
}
