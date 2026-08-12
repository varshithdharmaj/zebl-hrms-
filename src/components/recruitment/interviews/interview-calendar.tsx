"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { buildInterviewCalendarHref } from "@/lib/recruitment/interview/calendar-range";

interface CalendarInterview {
  id: string;
  title: string | null;
  roundType: string;
  status: string;
  scheduledStart: Date | string | null;
  scheduledEnd: Date | string | null;
  application: {
    candidate: {
      fullName: string;
    } | null;
    jobOpening: {
      title: string;
    } | null;
  } | null;
}

export function InterviewCalendar({
  interviews,
  month,
  year,
  view,
  layout,
}: {
  interviews: CalendarInterview[];
  month: number;
  year: number;
  view: string;
  layout: string;
}) {
  const monthIndex = month - 1;

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const firstDayOfMonth = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const now = new Date();
  const todayMonth = now.getMonth() + 1;
  const todayYear = now.getFullYear();

  const prevMonthDate = new Date(year, monthIndex - 1, 1);
  const nextMonthDate = new Date(year, monthIndex + 1, 1);

  const prevHref = buildInterviewCalendarHref({
    view,
    layout,
    month: prevMonthDate.getMonth() + 1,
    year: prevMonthDate.getFullYear(),
  });
  const nextHref = buildInterviewCalendarHref({
    view,
    layout,
    month: nextMonthDate.getMonth() + 1,
    year: nextMonthDate.getFullYear(),
  });
  const todayHref = buildInterviewCalendarHref({
    view,
    layout,
    month: todayMonth,
    year: todayYear,
  });

  const days: Array<Date | null> = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, monthIndex, i));
  }

  const getInterviewsForDay = (date: Date) => {
    return interviews.filter((item) => {
      if (!item.scheduledStart) return false;
      const d = new Date(item.scheduledStart);
      return (
        d.getDate() === date.getDate() &&
        d.getMonth() === date.getMonth() &&
        d.getFullYear() === date.getFullYear()
      );
    });
  };

  return (
    <div className="border border-border rounded-xl bg-card shadow-subtle overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">
            {monthNames[monthIndex]} {year}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button asChild variant="outline" size="sm" className="font-semibold text-xs">
            <Link href={todayHref}>Today</Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded-lg">
            <Link href={prevHref} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded-lg">
            <Link href={nextHref} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-bold text-muted-foreground py-2 tracking-wider uppercase">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      <div className="grid grid-cols-7 divide-x divide-y divide-border/60 border-l border-t border-border/40 min-h-[480px]">
        {days.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="bg-muted/5" />;
          }

          const dayInterviews = getInterviewsForDay(date);
          const isToday =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();

          return (
            <div
              key={date.toISOString()}
              className={`p-2 flex flex-col gap-1.5 min-h-[80px] transition-colors ${
                isToday ? "bg-primary/5" : "hover:bg-muted/10"
              }`}
            >
              <span
                className={`text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full ${
                  isToday ? "bg-primary text-white" : "text-muted-foreground"
                }`}
              >
                {date.getDate()}
              </span>

              <div className="flex-1 overflow-y-auto space-y-1 max-h-[100px] pr-0.5">
                {dayInterviews.map((item) => (
                  <Link
                    key={item.id}
                    href={`/admin/recruitment/interviews/${item.id}`}
                    className={`block text-[10px] p-1.5 rounded-lg border leading-tight font-semibold hover:shadow-subtle transition-shadow ${
                      item.status === "completed"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                        : item.status === "cancelled"
                          ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/20"
                          : item.status === "no_show"
                            ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20"
                            : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20"
                    }`}
                  >
                    <div className="truncate font-bold">{item.title ?? "Interview"}</div>
                    <div className="truncate text-[9px] text-muted-foreground/90 mt-0.5 font-medium flex items-center gap-0.5">
                      <User className="h-2.5 w-2.5 shrink-0" />
                      {item.application?.candidate?.fullName ?? "Candidate"}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
