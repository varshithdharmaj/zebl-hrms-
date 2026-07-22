import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  isWorkedDayCategory,
  isShortHoursTier,
  type AttendanceDayCategory,
  type AttendanceRatioTier,
} from "@/lib/attendance/day-classification";

type DotVariant = "target" | "short" | "neutral";

type Point = {
  date: string;
  label: string;
  hours: number;
  dotVariant: DotVariant;
};

function dotVariantFor(category: AttendanceDayCategory, ratioTier: AttendanceRatioTier | null): DotVariant {
  if (!isWorkedDayCategory(category)) return "neutral";
  return isShortHoursTier(ratioTier) ? "short" : "target";
}

export function AttendanceLineChart({
  records,
  className,
}: {
  records: {
    attendanceDate: Date;
    workedMinutes: number;
    category: AttendanceDayCategory;
    ratioTier: AttendanceRatioTier | null;
  }[];
  className?: string;
}) {
  const points = useMemo<Point[]>(() => {
    return [...records]
      .sort(
        (a, b) =>
          new Date(a.attendanceDate).getTime() - new Date(b.attendanceDate).getTime()
      )
      .map((r) => {
        const d = new Date(r.attendanceDate);
        return {
          date: d.toISOString(),
          label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          hours: r.workedMinutes / 60,
          dotVariant: dotVariantFor(r.category, r.ratioTier),
        };
      });
  }, [records]);

  const width = 100;
  const height = 48;
  const padX = 2;
  const padY = 4;
  const maxHours = Math.max(8, ...points.map((p) => p.hours), 1);

  const coords = points.map((p, i) => {
    const x =
      points.length <= 1
        ? width / 2
        : padX + (i / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - (p.hours / maxHours) * (height - padY * 2);
    return { x, y, ...p };
  });

  const linePath =
    coords.length > 0
      ? coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ")
      : "";

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`
      : "";

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground",
          className
        )}
      >
        No attendance data for this period
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative h-48 w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1={padX}
              x2={width - padX}
              y1={height - padY - ratio * (height - padY * 2)}
              y2={height - padY - ratio * (height - padY * 2)}
              stroke="#e8edf4"
              strokeWidth="0.5"
            />
          ))}
          {areaPath && <path d={areaPath} fill="url(#chartFill)" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {coords.map((c) => (
            <circle
              key={c.date}
              cx={c.x}
              cy={c.y}
              r="1.8"
              fill={
                c.dotVariant === "target"
                  ? "#10b981"
                  : c.dotVariant === "short"
                    ? "#f59e0b"
                    : "#94a3b8"
              }
              stroke="#fff"
              strokeWidth="0.6"
            />
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Hours worked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent-green" />
            Target met
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent-amber" />
            Short hours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Non-working day
          </span>
        </div>
        {points.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {points[0].label} – {points[points.length - 1].label}
          </p>
        )}
      </div>
    </div>
  );
}
