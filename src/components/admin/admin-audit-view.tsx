"use client";

import Link from "next/link";
import { exportAuditLogsAction } from "@/actions/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import type { AuditLogRow } from "@/lib/audit/audit-queries";

export function AdminAuditView({
  logs,
  total,
  page,
  pageSize,
  filters,
  filterOptions,
}: {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    q?: string;
    entityType?: string;
    action?: string;
    actorEmail?: string;
  };
  filterOptions: { entityTypes: string[]; actions: string[] };
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleExport() {
    const result = await exportAuditLogsAction(filters);
    if ("error" in result) {
      alert(result.error);
      return;
    }
    const blob = new Blob([result.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Search & filter" description={`${total} total entries`}>
        <form method="get" className="flex flex-wrap gap-3">
          <Input name="q" placeholder="Search…" defaultValue={filters.q ?? ""} className="max-w-xs" />
          <Input
            name="actorEmail"
            placeholder="Actor email"
            defaultValue={filters.actorEmail ?? ""}
            className="max-w-xs"
          />
          <select
            name="entityType"
            defaultValue={filters.entityType ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All entity types</option>
            {filterOptions.entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            name="action"
            defaultValue={filters.action ?? ""}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All actions</option>
            {filterOptions.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input type="hidden" name="page" value="1" />
          <Button type="submit" variant="outline">
            Apply
          </Button>
          <Button type="button" variant="secondary" onClick={() => void handleExport()}>
            Export CSV
          </Button>
          <Link href="/admin/audit" className="text-sm text-muted-foreground hover:underline self-center">
            Clear
          </Link>
        </form>
      </SectionCard>

      <SectionCard title="Audit log" description="Workflow, auth, and notification traceability">
        <DataTable
          columns={["Time", "Action", "Entity", "Actor", "Details"]}
          emptyMessage="No audit entries match your filters."
        >
          {logs.map((row) => (
            <DataTableRow key={row.id}>
              <DataTableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(row.createdAt)}
              </DataTableCell>
              <DataTableCell className="font-mono text-xs">{row.action}</DataTableCell>
              <DataTableCell>
                <span className="text-muted-foreground">{row.entityType}</span>
                <span className="mx-1">/</span>
                <span>{row.entityId}</span>
              </DataTableCell>
              <DataTableCell>{row.actorEmail ?? "—"}</DataTableCell>
              <DataTableCell className="max-w-md truncate text-xs text-muted-foreground">
                {Object.keys(row.metadata).length > 0
                  ? JSON.stringify(row.metadata)
                  : "—"}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>

        {totalPages > 1 && (
          <div className="mt-4 flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/audit?${buildQuery({ ...filters, page: page - 1 })}`}
                className="text-sm text-primary hover:underline"
              >
                Previous
              </Link>
            )}
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/admin/audit?${buildQuery({ ...filters, page: page + 1 })}`}
                className="text-sm text-primary hover:underline"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}
