"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReportTable } from "@/lib/recruitment/reports/types";

const PAGE_SIZE = 10;

export function ReportDataTable({
  table,
  selectedIds,
  onSelectedIdsChange,
}: {
  table: ReportTable;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
}) {
  const [sortKey, setSortKey] = useState<string>(table.columns[0]?.key ?? "id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = !q
      ? table.rows
      : table.rows.filter((row) =>
          table.columns.some((column) =>
            String(row[column.key] ?? "").toLowerCase().includes(q)
          )
        );

    return [...rows].sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const leftNum = typeof left === "number" ? left : Number(left);
      const rightNum = typeof right === "number" ? right : Number(right);
      if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
        return sortDir === "asc" ? leftNum - rightNum : rightNum - leftNum;
      }
      const cmp = String(left ?? "").localeCompare(String(right ?? ""));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [query, sortDir, sortKey, table.columns, table.rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allVisibleSelected =
    pageRows.length > 0 &&
    pageRows.every((row) => selectedIds.includes(String(row.id ?? "")));

  return (
    <section className="rounded-xl border border-border bg-card shadow-subtle overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{table.title}</h3>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Filter rows…"
          aria-label={`Filter ${table.title}`}
          className="h-9 rounded-lg border border-border bg-background px-3 text-xs"
        />
      </div>
      <div className="overflow-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th className="border-b border-border px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  aria-label="Select visible rows"
                  onChange={(event) => {
                    const visibleIds = pageRows.map((row) => String(row.id ?? ""));
                    if (event.target.checked) {
                      onSelectedIdsChange(
                        Array.from(new Set([...selectedIds, ...visibleIds]))
                      );
                    } else {
                      onSelectedIdsChange(
                        selectedIds.filter((id) => !visibleIds.includes(id))
                      );
                    }
                  }}
                />
              </th>
              {table.columns.map((column) => (
                <th key={column.key} className="border-b border-border px-3 py-2 text-left">
                  <button
                    type="button"
                    className="font-semibold text-slate-700 hover:text-slate-900"
                    onClick={() => {
                      if (sortKey === column.key) {
                        setSortDir((value) => (value === "asc" ? "desc" : "asc"));
                      } else {
                        setSortKey(column.key);
                        setSortDir("asc");
                      }
                    }}
                  >
                    {column.label}
                    {sortKey === column.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const id = String(row.id ?? "");
              return (
                <tr key={id} className="hover:bg-muted/30">
                  <td className="border-b border-border/70 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(id)}
                      aria-label={`Select row ${id}`}
                      onChange={(event) => {
                        if (event.target.checked) {
                          onSelectedIdsChange([...selectedIds, id]);
                        } else {
                          onSelectedIdsChange(selectedIds.filter((value) => value !== id));
                        }
                      }}
                    />
                  </td>
                  {table.columns.map((column) => (
                    <td key={column.key} className="border-b border-border/70 px-3 py-2">
                      {String(row[column.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          {filtered.length} rows · page {page}/{totalPages}
          {selectedIds.length > 0 ? ` · ${selectedIds.length} selected` : ""}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
