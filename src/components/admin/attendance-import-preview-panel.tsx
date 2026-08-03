"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type {
  AttendanceImportPreview,
  AttendancePreviewRow,
  AttendancePreviewValidationStatus,
} from "@/lib/attendance/import/preview-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
} from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const PAGE_SIZE = 25;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function reportTypeLabel(type: string): string {
  switch (type) {
    case "EXCEL_DAILY":
      return "Excel Daily";
    case "PDF_DAILY":
      return "PDF Daily";
    case "PDF_SUMMARY":
      return "PDF Summary";
    default:
      return type;
  }
}

function validationClass(status: AttendancePreviewValidationStatus): string {
  switch (status) {
    case "valid":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20";
    case "warning":
    case "duplicate":
    case "unknown_employee":
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20";
    case "error":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

function statusLabel(status: AttendancePreviewValidationStatus): string {
  switch (status) {
    case "valid":
      return "Valid";
    case "warning":
      return "Warning";
    case "duplicate":
      return "Duplicate";
    case "unknown_employee":
      return "Unknown";
    case "error":
      return "Error";
    default:
      return status;
  }
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3",
        tone === "success" && "border-success/25 bg-success-muted/40",
        tone === "warning" && "border-amber-500/25 bg-amber-500/5",
        tone === "danger" && "border-destructive/25 bg-destructive/5",
        !tone && "border-border bg-muted/20"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function AttendanceImportPreviewPanel({
  preview,
  confirming,
  onConfirm,
  onCancel,
}: {
  preview: AttendanceImportPreview;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return preview.rows;
    return preview.rows.filter((row) => {
      return (
        row.employeeCode.toLowerCase().includes(q) ||
        row.employeeName.toLowerCase().includes(q) ||
        (row.attendanceDate ?? "").includes(q) ||
        row.status.toLowerCase().includes(q) ||
        row.validationStatus.toLowerCase().includes(q)
      );
    });
  }, [preview.rows, deferredQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6" aria-live="polite">
      <SectionCard
        title="Upload summary"
        description="Parsed once — confirm to write attendance records."
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">File</dt>
            <dd className="font-medium break-all">{preview.meta.fileName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Report type</dt>
            <dd className="font-medium">{reportTypeLabel(preview.reportType)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">File size</dt>
            <dd className="font-medium">{formatFileSize(preview.meta.fileSize)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Employees detected</dt>
            <dd className="font-medium tabular-nums">{preview.summary.employeesDetected}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Dates detected</dt>
            <dd className="font-medium tabular-nums">{preview.summary.datesDetected}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Attendance date source</dt>
            <dd className="font-medium">
              {preview.meta.datesFromFile
                ? "From PDF rows"
                : preview.meta.formAttendanceDate ?? "—"}
            </dd>
          </div>
        </dl>
        {preview.meta.datesFromFile && (
          <p className="mt-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            Dates will be imported from the PDF. The upload date field is not used for Summary
            reports.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Validation summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Valid" value={preview.summary.validRows} tone="success" />
          <StatCard label="Duplicates" value={preview.summary.duplicateRows} tone="warning" />
          <StatCard label="Warnings" value={preview.summary.warnings} tone="warning" />
          <StatCard label="Errors" value={preview.summary.errors} tone="danger" />
          <StatCard
            label="Unknown employees"
            value={preview.summary.unknownEmployees}
            tone="warning"
          />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {preview.summary.importableRows} of {preview.summary.totalRows} rows ready to import
        </p>
      </SectionCard>

      <SectionCard
        title="Attendance preview"
        description="Search and review rows before confirming."
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full max-w-sm space-y-1.5">
            <Label htmlFor="preview-search">Search rows</Label>
            <Input
              id="preview-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Employee, date, status…"
              aria-label="Search preview rows"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {pageRows.length} of {filtered.length} filtered · page {safePage + 1}/
            {pageCount}
          </p>
        </div>

        <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
          <DataTable
            columns={[
              "Employee",
              "Date",
              "Shift",
              "Check in",
              "Check out",
              "Status",
              "Validation",
            ]}
            emptyMessage="No rows match your search."
          >
            {pageRows.map((row) => (
              <PreviewTableRow key={row.rowIndex} row={row} />
            ))}
          </DataTable>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Previous preview page"
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            aria-label="Next preview page"
          >
            Next
          </Button>
        </div>
      </SectionCard>

      {preview.warnings.length > 0 && (
        <div
          className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-medium text-foreground">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {preview.warnings.slice(0, 12).map((w, i) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
          </ul>
          {preview.warnings.length > 12 && (
            <p className="mt-2 text-xs text-muted-foreground">
              +{preview.warnings.length - 12} more
            </p>
          )}
        </div>
      )}

      {preview.errors.length > 0 && (
        <div
          className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium text-foreground">Errors</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            {preview.errors.slice(0, 12).map((e, i) => (
              <li key={`${e.code}-${i}`}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={confirming} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={confirming || !preview.canConfirm}
          onClick={onConfirm}
          aria-disabled={confirming || !preview.canConfirm}
        >
          {confirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Importing…
            </>
          ) : (
            "Confirm import"
          )}
        </Button>
      </div>
    </div>
  );
}

function PreviewTableRow({ row }: { row: AttendancePreviewRow }) {
  return (
    <DataTableRow
      className={cn(
        row.validationStatus === "error" && "bg-destructive/5",
        row.validationStatus === "duplicate" && "bg-amber-500/5"
      )}
    >
      <DataTableCell>
        <div className="min-w-[8rem]">
          <p className="font-medium">{row.employeeCode || "—"}</p>
          <p className="text-xs text-muted-foreground">{row.employeeName || "—"}</p>
        </div>
      </DataTableCell>
      <DataTableCell className="whitespace-nowrap tabular-nums">
        {row.attendanceDate ?? "—"}
      </DataTableCell>
      <DataTableCell>{row.shift || "—"}</DataTableCell>
      <DataTableCell className="tabular-nums">{row.inTime || "—"}</DataTableCell>
      <DataTableCell className="tabular-nums">{row.outTime || "—"}</DataTableCell>
      <DataTableCell>{row.status || "—"}</DataTableCell>
      <DataTableCell>
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tracking-tight",
            validationClass(row.validationStatus)
          )}
        >
          {statusLabel(row.validationStatus)}
        </span>
        {row.messages[0] && (
          <p className="mt-1 max-w-[14rem] text-xs text-muted-foreground">{row.messages[0]}</p>
        )}
      </DataTableCell>
    </DataTableRow>
  );
}
