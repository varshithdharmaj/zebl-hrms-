"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CalendarInterview {
  id: string;
  title: string;
  roundType: string;
  status: string;
  scheduledStart: Date | string;
  scheduledEnd: Date | string;
  application: {
    candidate: {
      fullName: string;
    };
    jobOpening: {
      title: string;
    };
  };
}

export function InterviewCalendar({ interviews }: { interviews: CalendarInterview[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Get days in month
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  const getInterviewsForDay = (date: Date) => {
    return interviews.filter((item) => {
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
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">
            {monthNames[month]} {year}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={today} className="font-semibold text-xs">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-lg">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-lg">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center text-xs font-bold text-muted-foreground py-2 tracking-wider uppercase">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Grid Days */}
      <div className="grid grid-cols-7 divide-x divide-y divide-border/60 border-l border-t border-border/40 min-h-[480px]">
        {days.map((date, idx) => {
          if (!date) {
            return <div key={`empty-${idx}`} className="bg-muted/5" />;
          }

          const dayInterviews = getInterviewsForDay(date);
          const isToday =
            date.getDate() === new Date().getDate() &&
            date.getMonth() === new Date().getMonth() &&
            date.getFullYear() === new Date().getFullYear();

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
                    <div className="truncate font-bold">{item.title}</div>
                    <div className="truncate text-[9px] text-muted-foreground/90 mt-0.5 font-medium flex items-center gap-0.5">
                      <User className="h-2.5 w-2.5 shrink-0" />
                      {item.application.candidate.fullName}
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
