import * as XLSX from "xlsx";
import type { ReportBundle, ReportExportFormat, ReportTable } from "./types";

function escapeCsv(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function selectTableRows(
  table: ReportTable,
  selectedRowIds?: string[]
): ReportTable["rows"] {
  if (!selectedRowIds || selectedRowIds.length === 0) return table.rows;
  const selected = new Set(selectedRowIds);
  return table.rows.filter((row) => selected.has(String(row.id ?? "")));
}

export function buildReportCsv(
  bundle: ReportBundle,
  options?: { tableId?: string; selectedRowIds?: string[] }
): string {
  const tables = options?.tableId
    ? bundle.tables.filter((table) => table.id === options.tableId)
    : bundle.tables;

  const chunks: string[] = [
    `Report,${escapeCsv(bundle.title)}`,
    `Generated,${escapeCsv(bundle.generatedAt)}`,
    "",
  ];

  for (const table of tables) {
    const rows = selectTableRows(table, options?.selectedRowIds);
    chunks.push(escapeCsv(table.title));
    chunks.push(table.columns.map((column) => escapeCsv(column.label)).join(","));
    for (const row of rows) {
      chunks.push(
        table.columns.map((column) => escapeCsv(row[column.key])).join(",")
      );
    }
    chunks.push("");
  }

  return chunks.join("\n");
}

export function buildReportExcel(
  bundle: ReportBundle,
  options?: { tableId?: string; selectedRowIds?: string[] }
): Buffer {
  const wb = XLSX.utils.book_new();
  const summary = [
    ["Report", bundle.title],
    ["Section", bundle.section],
    ["Generated", bundle.generatedAt],
    ...bundle.kpis.map((kpi) => [kpi.label, kpi.value]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  const tables = options?.tableId
    ? bundle.tables.filter((table) => table.id === options.tableId)
    : bundle.tables;

  for (const table of tables) {
    const rows = selectTableRows(table, options?.selectedRowIds).map((row) => {
      const out: Record<string, string | number | null | undefined> = {};
      for (const column of table.columns) {
        out[column.label] = row[column.key];
      }
      return out;
    });
    const sheetName = table.title.slice(0, 31) || table.id.slice(0, 31);
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      sheetName
    );
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildReportHtml(
  bundle: ReportBundle,
  options?: { tableId?: string; selectedRowIds?: string[]; printable?: boolean }
): string {
  const tables = options?.tableId
    ? bundle.tables.filter((table) => table.id === options.tableId)
    : bundle.tables;

  const kpiHtml = bundle.kpis
    .map(
      (kpi) =>
        `<div class="card"><span>${escapeHtml(kpi.label)}</span><strong>${escapeHtml(String(kpi.value))}</strong></div>`
    )
    .join("");

  const tablesHtml = tables
    .map((table) => {
      const rows = selectTableRows(table, options?.selectedRowIds);
      const head = table.columns
        .map((column) => `<th>${escapeHtml(column.label)}</th>`)
        .join("");
      const body = rows
        .map(
          (row) =>
            `<tr>${table.columns
              .map((column) => `<td>${escapeHtml(String(row[column.key] ?? ""))}</td>`)
              .join("")}</tr>`
        )
        .join("");
      return `<h2>${escapeHtml(table.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(bundle.title)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; margin: 2rem; color: #0f172a; background: #fff; }
    h1 { font-size: 1.6rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.1rem; margin-top: 1.75rem; }
    .muted { color: #64748b; font-size: 0.9rem; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin: 1.25rem 0; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; background: #f8fafc; }
    .card span { display: block; font-size: 0.75rem; color: #64748b; }
    .card strong { display: block; margin-top: 0.35rem; font-size: 1.25rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.85rem; }
    th, td { border: 1px solid #e2e8f0; padding: 0.45rem 0.55rem; text-align: left; }
    th { background: #f1f5f9; position: sticky; top: 0; }
    @media print {
      body { margin: 1cm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(bundle.title)}</h1>
  <p class="muted">Generated ${escapeHtml(bundle.generatedAt)}</p>
  <div class="metrics">${kpiHtml}</div>
  ${tablesHtml}
  <p class="muted">${options?.printable === false ? "" : "Print this page to save as PDF."}</p>
  ${
    options?.printable
      ? `<script>window.addEventListener("load", () => window.print());</script>`
      : ""
  }
</body>
</html>`;
}

export function getExportMime(format: ReportExportFormat): string {
  switch (format) {
    case "csv":
      return "text/csv; charset=utf-8";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pdf":
    case "print":
      return "text/html; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export function getExportFilename(
  bundle: ReportBundle,
  format: ReportExportFormat
): string {
  const stamp = bundle.generatedAt.slice(0, 10);
  if (format === "xlsx") return `recruitment-${bundle.section}-${stamp}.xlsx`;
  if (format === "csv") return `recruitment-${bundle.section}-${stamp}.csv`;
  return `recruitment-${bundle.section}-${stamp}.html`;
}

export function buildReportExport(
  bundle: ReportBundle,
  format: ReportExportFormat,
  options?: { tableId?: string; selectedRowIds?: string[] }
): { data: Buffer | string; mimeType: string; filename: string } {
  if (format === "csv") {
    return {
      data: buildReportCsv(bundle, options),
      mimeType: getExportMime(format),
      filename: getExportFilename(bundle, format),
    };
  }
  if (format === "xlsx") {
    return {
      data: buildReportExcel(bundle, options),
      mimeType: getExportMime(format),
      filename: getExportFilename(bundle, format),
    };
  }
  return {
    data: buildReportHtml(bundle, {
      ...options,
      printable: format === "print" || format === "pdf",
    }),
    mimeType: getExportMime(format),
    filename: getExportFilename(bundle, format),
  };
}
