"use client";

import { Download } from "lucide-react";
import {
  exportLoginHistoryCsvAction,
  exportLoginHistoryExcelAction,
} from "@/actions/login-history";
import { Button } from "@/components/ui/button";
import type { LoginHistoryFilters } from "@/lib/security/login-history-service";

function download(content: BlobPart, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function LoginHistoryExportButtons({
  filters,
  allowExcel,
}: {
  filters: LoginHistoryFilters;
  allowExcel: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={async () => {
          const result = await exportLoginHistoryCsvAction(filters);
          download(result.csv, "text/csv;charset=utf-8", `login-history-${Date.now()}.csv`);
        }}
      >
        <Download className="h-4 w-4" />
        CSV
      </Button>
      {allowExcel && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            const result = await exportLoginHistoryExcelAction(filters);
            const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
            download(
              bytes,
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              `login-history-${Date.now()}.xlsx`
            );
          }}
        >
          <Download className="h-4 w-4" />
          Excel
        </Button>
      )}
    </div>
  );
}
