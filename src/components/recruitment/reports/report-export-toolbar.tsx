"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportSectionKey } from "@/lib/recruitment/reports/types";
import { filtersToSearchParams } from "@/lib/recruitment/reports/parse-filters";
import type { RecruitmentReportFilters } from "@/lib/recruitment/reports/types";

function triggerDownload(filename: string, mimeType: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportExportToolbar({
  section,
  filters,
  selectedRowIds,
  activeTableId,
}: {
  section: ReportSectionKey;
  filters: RecruitmentReportFilters;
  selectedRowIds: string[];
  activeTableId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = filtersToSearchParams(filters);
    params.set("section", section);
    if (activeTableId) params.set("tableId", activeTableId);
    for (const id of selectedRowIds) params.append("selectedRowIds", id);
    return params;
  }, [activeTableId, filters, section, selectedRowIds]);

  const openExport = (format: "csv" | "xlsx" | "pdf" | "print") => {
    setError(null);
    startTransition(() => {
      const params = new URLSearchParams(query.toString());
      params.set("format", format);
      const href = `/api/recruitment/reports/export?${params.toString()}`;
      if (format === "print" || format === "pdf") {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }
      void fetch(href)
        .then(async (response) => {
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(payload?.error ?? "Export failed");
          }
          const blob = await response.blob();
          const disposition = response.headers.get("Content-Disposition") ?? "";
          const match = /filename="([^"]+)"/.exec(disposition);
          const filename = match?.[1] ?? `report.${format}`;
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = filename;
          anchor.click();
          URL.revokeObjectURL(url);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Export failed");
        });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={isPending}
        onClick={() => openExport("csv")}
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        CSV{selectedRowIds.length > 0 ? " (selected)" : ""}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={isPending}
        onClick={() => openExport("xlsx")}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
        Excel
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={isPending}
        onClick={() => openExport("pdf")}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        PDF
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={isPending}
        onClick={() => openExport("print")}
      >
        <Printer className="h-3.5 w-3.5" aria-hidden />
        Print
      </Button>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      <span className="sr-only">{triggerDownload.name}</span>
    </div>
  );
}
