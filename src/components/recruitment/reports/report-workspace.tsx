"use client";

import { useState } from "react";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatsGrid } from "@/components/ui/stats-grid";
import type { ReportBundle, SavedReportPreset } from "@/lib/recruitment/reports/types";
import { ReportCharts } from "./report-charts";
import { ReportDataTable } from "./report-table";
import { ReportExportToolbar } from "./report-export-toolbar";
import { ReportFilters } from "./report-filters";

export function ReportWorkspace({
  bundle,
  presets,
}: {
  bundle: ReportBundle;
  presets: SavedReportPreset[];
}) {
  const [selectedByTable, setSelectedByTable] = useState<Record<string, string[]>>(
    {}
  );
  const [activeTableId, setActiveTableId] = useState<string | undefined>(
    bundle.tables[0]?.id
  );

  const selectedRowIds = activeTableId
    ? selectedByTable[activeTableId] ?? []
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{bundle.title}</h2>
          <p className="text-sm text-muted-foreground">{bundle.description}</p>
        </div>
        <ReportExportToolbar
          section={bundle.section}
          filters={bundle.filters}
          selectedRowIds={selectedRowIds}
          activeTableId={activeTableId}
        />
      </div>

      <ReportFilters section={bundle.section} presets={presets} />

      <StatsGrid>
        {bundle.kpis.map((kpi) => (
          <DashboardCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            accent="teal"
          />
        ))}
      </StatsGrid>

      <ReportCharts charts={bundle.charts} />

      <div className="space-y-4">
        {bundle.tables.map((table) => (
          <div
            key={table.id}
            onFocusCapture={() => setActiveTableId(table.id)}
            onClick={() => setActiveTableId(table.id)}
          >
            <ReportDataTable
              table={table}
              selectedIds={selectedByTable[table.id] ?? []}
              onSelectedIdsChange={(ids) =>
                setSelectedByTable((prev) => ({ ...prev, [table.id]: ids }))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
