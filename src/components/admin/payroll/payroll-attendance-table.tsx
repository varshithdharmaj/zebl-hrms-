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
import type { PayrollHrDecision } from "@/generated/prisma/enums";
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
  no_action: "text-slate-500 font-medium",
  apply_leave: "text-amber-800 font-semibold",
  salary_deduction: "text-rose-800 font-semibold",
  warning: "text-orange-800 font-semibold",
  approved_exception: "text-emerald-800 font-semibold",
};

function HrDecisionForm({ row }: { row: PayrollTableRow }) {
  const [state, formAction, pending] = useActionState(updatePayrollHrDecisionAction, initial);
  const currentLabel =
    PAYROLL_HR_DECISION_OPTIONS.find((o) => o.value === row.hrDecision)?.label ?? "No Action";

  return (
    <form action={formAction} className="w-[10rem] space-y-1">
      <input type="hidden" name="summaryId" value={row.id} />
      <div className="flex gap-1">
        <select
          name="hrDecision"
          defaultValue={row.hrDecision}
          title={currentLabel}
          className="h-7 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-1.5 text-[0.6875rem] font-medium leading-tight text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
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
          className="h-7 shrink-0 px-2 text-[0.6875rem] font-semibold"
        >
          {pending ? "…" : "Save"}
        </Button>
      </div>
      <Input
        name="remarks"
        defaultValue={row.remarks ?? ""}
        placeholder="HR Notes..."
        className="h-7 rounded-md px-2 text-[0.6875rem] border-slate-200"
      />
      {state.error && (
        <p className="text-[0.625rem] font-semibold leading-snug text-rose-600">{state.error}</p>
      )}
      {state.success && (
        <p className="text-[0.625rem] font-semibold leading-snug text-emerald-600">Saved</p>
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
          <DataTableCell colSpan={12} className="py-12 text-center text-sm text-slate-500">
            No payroll summaries match your selected period and filters.
          </DataTableCell>
        </DataTableRow>
      ) : (
        rows.map((row) => (
          <DataTableRow key={row.id}>
            <DataTableCell className="align-top">
              <p className="font-semibold text-slate-900">{row.employee.name}</p>
              <p className="text-xs font-medium text-slate-500">{row.employee.employeeCode}</p>
            </DataTableCell>
            <DataTableCell className="align-top">
              <AttendanceShiftCell shift={row.employee.shift} compact />
            </DataTableCell>
            <DataTableCell className="tabular-nums font-semibold text-slate-900 align-top">{row.workingDays}</DataTableCell>
            <DataTableCell className="tabular-nums font-medium text-slate-700 align-top whitespace-nowrap">
              {formatMinutesAsHours(row.requiredMinutes)}
            </DataTableCell>
            <DataTableCell className="tabular-nums font-semibold text-slate-900 align-top whitespace-nowrap">
              {formatMinutesAsHours(row.actualMinutes)}
            </DataTableCell>
            <DataTableCell className="tabular-nums align-top whitespace-nowrap">
              {row.shortfallMinutes > 0 ? (
                <span className="inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-600/20">
                  {formatMinutesAsHours(row.shortfallMinutes)}
                </span>
              ) : (
                <span className="text-xs text-slate-400">0h 00m</span>
              )}
            </DataTableCell>
            <DataTableCell className="tabular-nums align-top whitespace-nowrap">
              {row.otMinutes > 0 ? (
                <span className="inline-flex rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20">
                  {formatMinutesAsHours(row.otMinutes)}
                </span>
              ) : (
                <span className="text-xs text-slate-400">0h 00m</span>
              )}
            </DataTableCell>
            <DataTableCell className="tabular-nums font-medium text-slate-700 align-top">{row.leaveDays}</DataTableCell>
            <DataTableCell className="tabular-nums align-top">
              {row.absentDays > 0 ? (
                <span className="font-bold text-rose-600">{row.absentDays}</span>
              ) : (
                <span className="text-slate-400">0</span>
              )}
            </DataTableCell>
            <DataTableCell className="tabular-nums font-medium text-slate-700 align-top">{row.lateCount}</DataTableCell>
            <DataTableCell className="align-top max-w-[11rem] text-xs font-medium text-slate-600">
              {row.recommendedDeduction ?? "—"}
            </DataTableCell>
            <DataTableCell className="align-top w-[10.5rem] max-w-[10.5rem]">
              <HrDecisionForm row={row} />
            </DataTableCell>
          </DataTableRow>
        ))
      )}
    </DataTable>
  );
}
