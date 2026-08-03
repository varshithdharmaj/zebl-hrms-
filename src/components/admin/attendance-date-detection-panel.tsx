"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AttendanceReportDetectionState } from "@/hooks/use-attendance-report-detection";
import { resolveAttendanceDateFieldMode } from "@/lib/attendance/import/report-metadata";
import { cn } from "@/lib/utils";

type AttendanceDateDetectionPanelProps = {
  hasFile: boolean;
  detection: AttendanceReportDetectionState;
  dateInputId: string;
  attendanceDate: string;
  onAttendanceDateChange: (value: string) => void;
  disabled?: boolean;
  /** When false, omit the name= attribute. */
  includeFormName?: boolean;
};

/**
 * Shows analyzing state, Summary info banner, or Attendance Date field
 * based on report detection — compact, accessible.
 */
export function AttendanceDateDetectionPanel({
  hasFile,
  detection,
  dateInputId,
  attendanceDate,
  onAttendanceDateChange,
  disabled = false,
  includeFormName = true,
}: AttendanceDateDetectionPanelProps) {
  const mode = resolveAttendanceDateFieldMode({
    hasFile,
    status: detection.status,
    metadata: detection.metadata,
  });

  if (mode === "hidden") {
    return null;
  }

  if (mode === "detecting") {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground transition-opacity duration-200"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Analyzing report"
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <span>Analyzing report…</span>
      </div>
    );
  }

  if (mode === "summary") {
    const label =
      detection.metadata?.label ?? "Summary Attendance PDF detected";
    const detectedDate = detection.metadata?.detectedAttendanceDate;
    return (
      <div
        className="flex gap-3 rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-3 text-sm text-foreground transition-all duration-200"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2
          className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400"
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{label}</p>
          <p className="text-muted-foreground">
            {detectedDate
              ? `Attendance date ${detectedDate} will be imported from the PDF.`
              : "Attendance dates will be imported from the PDF."}
          </p>
        </div>
      </div>
    );
  }

  const label =
    detection.metadata?.label ?? "Report type could not be determined";
  const isUnknown = mode === "unknown";
  const helpId = `${dateInputId}-help`;

  return (
    <div
      className="space-y-3 transition-all duration-200"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2 text-sm text-foreground">
        <CheckCircle2
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            isUnknown
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-medium">
            {isUnknown && detection.metadata?.reportType !== "UNKNOWN"
              ? "Report type could not be determined"
              : label}
            {!isUnknown && (
              <span className="sr-only">. Attendance date is required.</span>
            )}
          </p>
          {isUnknown && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Report type could not be determined. Attendance Date will be
              required.
            </p>
          )}
        </div>
      </div>

      <div className="animate-in fade-in-0 slide-in-from-top-1 space-y-2 duration-200">
        <Label htmlFor={dateInputId}>Attendance date</Label>
        <Input
          id={dateInputId}
          name={includeFormName ? "attendanceDate" : undefined}
          type="date"
          value={attendanceDate}
          onChange={(e) => onAttendanceDateChange(e.target.value)}
          required
          disabled={disabled}
          aria-required="true"
          aria-describedby={helpId}
        />
        <p id={helpId} className="text-xs text-muted-foreground">
          This date will be applied to all imported attendance records.
        </p>
      </div>
    </div>
  );
}
