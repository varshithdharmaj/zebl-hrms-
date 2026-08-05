import { PermissionError } from "@/lib/permissions";
import { PeopleScopeEngine } from "@/lib/people-scope/engine";
import {
  getHolidaysForRange,
  getLeaveCalendarEvents,
  type CalendarLeaveEvent,
} from "@/lib/leave/leave-calendar";
import { addDays, startOfDay, toISODate } from "@/lib/utils";

export type MyTeamCalendarView = "month" | "week" | "range";

export type GetMyTeamCalendarParams = {
  view?: MyTeamCalendarView;
  /** Anchor date YYYY-MM-DD for month/week views. */
  date?: string;
  /** Explicit range start (range view). */
  from?: string;
  /** Explicit range end (range view). */
  to?: string;
};

export type MyTeamCalendarDto = {
  view: MyTeamCalendarView;
  rangeStart: Date;
  rangeEnd: Date;
  rangeLabel: string;
  events: CalendarLeaveEvent[];
  holidays: { id: number; name: string; holidayDate: Date }[];
  directReportCount: number;
};

function parseAnchor(dateStr?: string): Date {
  if (!dateStr) return startOfDay();
  const d = startOfDay(new Date(`${dateStr}T00:00:00`));
  return Number.isNaN(d.getTime()) ? startOfDay() : d;
}

function resolveRange(params: GetMyTeamCalendarParams): {
  view: MyTeamCalendarView;
  start: Date;
  end: Date;
  label: string;
} {
  const view = params.view ?? "month";

  if (view === "range" || params.from || params.to) {
    const from = params.from
      ? startOfDay(new Date(`${params.from}T00:00:00`))
      : startOfDay();
    const to = params.to
      ? startOfDay(new Date(`${params.to}T00:00:00`))
      : addDays(from, 13);
    const start = Number.isNaN(from.getTime()) ? startOfDay() : from;
    const end = Number.isNaN(to.getTime()) ? addDays(start, 13) : to;
    return {
      view: "range",
      start,
      end,
      label: `${toISODate(start)} → ${toISODate(end)}`,
    };
  }

  const anchor = parseAnchor(params.date);

  if (view === "week") {
    const day = anchor.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = addDays(anchor, mondayOffset);
    const end = addDays(start, 6);
    return {
      view: "week",
      start,
      end,
      label: `Week of ${start.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`,
    };
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return {
    view: "month",
    start: startOfDay(start),
    end: startOfDay(end),
    label: start.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
}

/**
 * Team leave calendar — events from shared {@link getLeaveCalendarEvents}
 * filtered to PeopleScopeEngine DIRECT IDs (never raw managerId).
 */
export async function getMyTeamCalendar(
  managerEmployeeId: number,
  params: GetMyTeamCalendarParams = {}
): Promise<MyTeamCalendarDto> {
  const isManager = await PeopleScopeEngine.isLineManager(managerEmployeeId);
  if (!isManager) {
    throw new PermissionError("My Team calendar is only available to line managers.");
  }

  const scope = await PeopleScopeEngine.resolveScope(managerEmployeeId);
  const { view, start, end, label } = resolveRange(params);

  if (scope.employeeIds.length === 0) {
    return {
      view,
      rangeStart: start,
      rangeEnd: end,
      rangeLabel: label,
      events: [],
      holidays: await getHolidaysForRange(start, end),
      directReportCount: 0,
    };
  }

  const [events, holidays] = await Promise.all([
    getLeaveCalendarEvents({
      start,
      end,
      employeeIds: scope.employeeIds,
    }),
    getHolidaysForRange(start, end),
  ]);

  return {
    view,
    rangeStart: start,
    rangeEnd: end,
    rangeLabel: label,
    events,
    holidays,
    directReportCount: scope.employeeIds.length,
  };
}
