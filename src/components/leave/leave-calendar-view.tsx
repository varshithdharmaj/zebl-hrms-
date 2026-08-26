"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { CalendarLeaveEvent } from "@/lib/leave/leave-calendar";

export function LeaveCalendarView({
  events,
  holidays,
  monthLabel,
  departments,
  currentDepartment,
}: {
  events: CalendarLeaveEvent[];
  holidays: { id: number; name: string; holidayDate: Date }[];
  monthLabel: string;
  departments: string[];
  currentDepartment?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{monthLabel}</span>
        <Link
          href="/admin/calendar"
          className={cn(
            "rounded-full px-3 py-1 text-xs",
            !currentDepartment ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          All
        </Link>
        {departments.map((d) => (
          <Link
            key={d}
            href={`/admin/calendar?department=${encodeURIComponent(d)}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              currentDepartment === d ? "bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {d}
          </Link>
        ))}
      </div>

      {holidays.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {holidays.map((h) => (
            <span
              key={h.id}
              className="rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs"
            >
              {h.name} · {formatDate(h.holidayDate)}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Employee</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No leave in this period.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{e.employeeName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{e.department ?? "—"}</td>
                  <td className="px-4 py-2">{e.leaveType}</td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    {formatDate(e.startDate)} – {formatDate(e.endDate)}
                  </td>
                  <td className="px-4 py-2 capitalize text-xs">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5",
                        e.workflowStatus === "approved"
                          ? "bg-success-muted text-success"
                          : "bg-warning-muted text-warning"
                      )}
                    >
                      {e.workflowStatus.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
