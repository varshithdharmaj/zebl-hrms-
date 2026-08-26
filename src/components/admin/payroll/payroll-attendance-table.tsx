"use client";

import { useActionState } from "react";
import {
  updatePayrollHrDecisionAction,
  type PayrollActionState,
} from "@/actions/payroll";
import { AttendanceShiftCell } from "@/components/attendance/attendance-shift-cell";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { formatMinutesAsHours } from "@/lib/payroll/payroll-display";
import { PAYROLL_HR_DECISION_OPTIONS } from "@/lib/payroll/payroll-types";
import type { PayrollHrDecision } from "@prisma/client";
import { cn } from "@/lib/utils";

export type PayrollTableRow = {
  id: number;
  employee: {
    name: string;
    employeeCode: string;
    shift: string | null;
  };
  workingDays: number;
  requiredMinutes: number;
  actualMinutes: number;
  shortfallMinutes: number;
  otMinutes: number;
  leaveDays: number;
  absentDays: number;
  lateCount: number;
  recommendedDeduction: string | null;
  hrDecision: PayrollHrDecision;
  remarks: string | null;
};

const initial: PayrollActionState = {};

const decisionBadgeClass: Record<PayrollHrDecision, string> = {
  no_action: "text-muted-foreground",
  apply_leave: "text-amber-800 dark:text-amber-200",
  salary_deduction: "text-red-800 dark:text-red-300",
  warning: "text-orange-800 dark:text-orange-200",
  approved_exception: "text-emerald-800 dark:text-emerald-200",
};

function HrDecisionForm({ row }: { row: PayrollTableRow }) {
  const [state, formAction, pending] = useActionState(updatePayrollHrDecisionAction, initial);
  const currentLabel =
    PAYROLL_HR_DECISION_OPTIONS.find((o) => o.value === row.hrDecision)?.label ?? "No Action";

  return (
    <form action={formAction} className="w-[9.5rem] space-y-1">
      <input type="hidden" name="summaryId" value={row.id} />
      <div className="flex gap-1">
        <select
          name="hrDecision"
          defaultValue={row.hrDecision}
          title={currentLabel}
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-[0.6875rem] leading-tight"
        >
          {PAYROLL_HR_DECISION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending}
          className="h-7 shrink-0 px-2 text-[0.6875rem]"
        >
          {pending ? "…" : "Save"}
        </Button>
      </div>
      <Input
        name="remarks"
        defaultValue={row.remarks ?? ""}
        placeholder="Notes"
        className="h-7 rounded-md px-2 text-[0.6875rem]"
      />
      {state.error && (
        <p className="text-[0.625rem] leading-snug text-danger">{state.error}</p>
      )}
      {state.success && (
        <p className="text-[0.625rem] leading-snug text-success">Saved</p>
      )}
      {!state.success && !state.error && (
        <p className={cn("truncate text-[0.625rem]", decisionBadgeClass[row.hrDecision])}>
          {currentLabel}
        </p>
      )}
    </form>
  );
}

export function PayrollAttendanceTable({ rows }: { rows: PayrollTableRow[] }) {
  return (
    <DataTable
      columns={[
        "Employee",
        "Shift",
        "Working Days",
        "Required",
        "Actual",
        "Shortfall",
        "OT",
        "Leave",
        "Absent",
        "Late",
        "Recommended",
        "HR Decision",
      ]}
    >
      {rows.length === 0 ? (
        <DataTableRow>
          <DataTableCell colSpan={12} className="py-10 text-center text-muted-foreground">
            No payroll summaries for this period and filters.
          </DataTableCell>
        </DataTableRow>
      ) : (
        rows.map((row) => (
          <DataTableRow key={row.id}>
            <DataTableCell className="align-top">
              <p className="font-medium">{row.employee.name}</p>
              <p className="text-xs text-muted-foreground">{row.employee.employeeCode}</p>
            </DataTableCell>
            <DataTableCell className="align-top">
              <AttendanceShiftCell shift={row.employee.shift} compact />
            </DataTableCell>
            <DataTableCell className="tabular-nums align-top">{row.workingDays}</DataTableCell>
            <DataTableCell className="tabular-nums align-top whitespace-nowrap">
              {formatMinutesAsHours(row.requiredMinutes)}
            </DataTableCell>
            <DataTableCell className="tabular-nums align-top whitespace-nowrap">
              {formatMinutesAsHours(row.actualMinutes)}
            </DataTableCell>
            <DataTableCell className="tabular-nums align-top whitespace-nowrap text-amber-800 dark:text-amber-200">
              {formatMinutesAsHours(row.shortfallMinutes)}
            </DataTableCell>
            <DataTableCell className="tabular-nums align-top whitespace-nowrap text-emerald-800 dark:text-emerald-200">
              {formatMinutesAsHours(row.otMinutes)}
            </DataTableCell>
            <DataTableCell className="tabular-nums align-top">{row.leaveDays}</DataTableCell>
            <DataTableCell className="tabular-nums align-top">{row.absentDays}</DataTableCell>
            <DataTableCell className="tabular-nums align-top">{row.lateCount}</DataTableCell>
            <DataTableCell className="align-top max-w-[11rem] text-xs text-muted-foreground">
              {row.recommendedDeduction ?? "—"}
            </DataTableCell>
            <DataTableCell className="align-top w-[10rem] max-w-[10rem]">
              <HrDecisionForm row={row} />
            </DataTableCell>
          </DataTableRow>
        ))
      )}
    </DataTable>
  );
}
