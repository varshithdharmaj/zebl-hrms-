import type { PdfDocument, PdfPage, PdfTextItem } from "./pdf-document";
import type { AttendanceImportParseResult, AttendanceImportRow } from "./types";

export const ESSL_DAILY_PDF_IMPORT_ERRORS = {
  NO_HEADER:
    "This Daily Attendance PDF does not contain a recognizable eSSL Basic Report header (SNo / E. Code / InTime / OutTime).",
  NO_ROWS:
    "This eSSL Daily Attendance PDF was recognized but no employee rows were found.",
} as const;

const Y_CLUSTER_TOLERANCE = 3;

type ColumnKey =
  | "snoCode"
  | "name"
  | "shift"
  | "inTime"
  | "outTime"
  | "workDuration"
  | "ot"
  | "totDur"
  | "status"
  | "remarks";

type ColumnAnchor = { key: ColumnKey; x: number };

type ClusterCell = { text: string; x: number };
type ClusterRow = { y: number; cells: ClusterCell[] };

type AccumRow = {
  employeeCode: string;
  employeeName: string;
  shift: string;
  inTime: string;
  outTime: string;
  workDuration: string;
  ot: string;
  status: string;
  remarks: string;
};

const HEADER_LABEL_TO_KEY: Array<{ pattern: RegExp; key: ColumnKey }> = [
  { pattern: /^sno\s*e\.?\s*code$/i, key: "snoCode" },
  { pattern: /^e\.?\s*code$/i, key: "snoCode" },
  { pattern: /^name$/i, key: "name" },
  { pattern: /^shift$/i, key: "shift" },
  { pattern: /^intime$/i, key: "inTime" },
  { pattern: /^outtime$/i, key: "outTime" },
  { pattern: /^work\s*dur\.?$/i, key: "workDuration" },
  { pattern: /^ot$/i, key: "ot" },
  { pattern: /^tot\.?\s*dur\.?$/i, key: "totDur" },
  { pattern: /^status$/i, key: "status" },
  { pattern: /^remarks?$/i, key: "remarks" },
];

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function clusterPageItems(items: readonly PdfTextItem[]): ClusterRow[] {
  const usable = items.filter((i) => i.text.trim().length > 0);
  if (usable.length === 0) return [];

  const sorted = [...usable].sort((a, b) => {
    if (Math.abs(b.y - a.y) > Y_CLUSTER_TOLERANCE) return b.y - a.y;
    return a.x - b.x;
  });

  const clusters: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(last.y - item.y) <= Y_CLUSTER_TOLERANCE) {
      last.items.push(item);
    } else {
      clusters.push({ y: item.y, items: [item] });
    }
  }

  return clusters.map((cluster) => ({
    y: cluster.y,
    cells: cluster.items
      .sort((a, b) => a.x - b.x)
      .map((i) => ({ text: i.text.trim(), x: i.x })),
  }));
}

function mapHeaderLabel(text: string): ColumnKey | null {
  const t = normalizeSpaces(text);
  for (const { pattern, key } of HEADER_LABEL_TO_KEY) {
    if (pattern.test(t)) return key;
  }
  return null;
}

function isEsslDailyHeaderRow(row: ClusterRow): boolean {
  const joined = row.cells.map((c) => c.text).join(" ").toLowerCase();
  const hasCode = /\be\.?\s*code\b/.test(joined) || /\bsno\b/.test(joined);
  const hasIn = /\bintime\b/.test(joined);
  const hasOut = /\bouttime\b/.test(joined);
  return hasCode && hasIn && hasOut;
}

function extractHeaderAnchors(row: ClusterRow): ColumnAnchor[] | null {
  const anchors: ColumnAnchor[] = [];
  for (const cell of row.cells) {
    const key = mapHeaderLabel(cell.text);
    if (key) anchors.push({ key, x: cell.x });
  }
  const keys = new Set(anchors.map((a) => a.key));
  if (!keys.has("snoCode") || !keys.has("name") || !keys.has("inTime") || !keys.has("outTime")) {
    return null;
  }
  return anchors.sort((a, b) => a.x - b.x);
}

function assignColumn(x: number, anchors: ColumnAnchor[]): ColumnKey {
  for (let i = 0; i < anchors.length; i++) {
    const cur = anchors[i]!;
    const next = anchors[i + 1];
    const rightBound = next ? (cur.x + next.x) / 2 : Number.POSITIVE_INFINITY;
    const leftBound =
      i === 0 ? Number.NEGATIVE_INFINITY : (anchors[i - 1]!.x + cur.x) / 2;
    if (x >= leftBound && x < rightBound) return cur.key;
  }
  return anchors[anchors.length - 1]!.key;
}

function isDataRowStart(row: ClusterRow, anchors: ColumnAnchor[]): boolean {
  const snoAnchor = anchors.find((a) => a.key === "snoCode");
  if (!snoAnchor) return false;
  const left = row.cells.find(
    (c) => Math.abs(c.x - snoAnchor.x) <= 25 || c.x < snoAnchor.x + 40
  );
  if (!left) return false;
  // "14 660012" or "1 1" — serial + employee code
  return /^\d+\s+\S+/.test(left.text);
}

function parseSnoCode(text: string): { sno: string; code: string } | null {
  const m = normalizeSpaces(text).match(/^(\d+)\s+(\S+)$/);
  if (!m) return null;
  return { sno: m[1], code: m[2] };
}

function appendField(current: string, next: string): string {
  const a = current.trim();
  const b = next.trim();
  if (!b) return a;
  if (!a) return b;
  // Soft hyphenation wrap: "Morni" + "ng" → "Morning"
  if (/^[a-z]{1,4}$/i.test(b) && /[a-z]$/i.test(a) && !a.endsWith(" ")) {
    return `${a}${b}`;
  }
  return `${a} ${b}`;
}

function cellsToFields(
  cells: ClusterCell[],
  anchors: ColumnAnchor[]
): Partial<Record<ColumnKey, string>> {
  const fields: Partial<Record<ColumnKey, string>> = {};
  for (const cell of cells) {
    const key = assignColumn(cell.x, anchors);
    fields[key] = appendField(fields[key] ?? "", cell.text);
  }
  return fields;
}

function mergeContinuation(
  row: AccumRow,
  fields: Partial<Record<ColumnKey, string>>
): void {
  if (fields.shift) row.shift = appendField(row.shift, fields.shift);
  if (fields.name) row.employeeName = appendField(row.employeeName, fields.name);
  if (fields.inTime) row.inTime = appendField(row.inTime, fields.inTime);
  if (fields.outTime) row.outTime = appendField(row.outTime, fields.outTime);
  if (fields.workDuration) {
    row.workDuration = appendField(row.workDuration, fields.workDuration);
  }
  if (fields.ot) row.ot = appendField(row.ot, fields.ot);
  if (fields.status) row.status = appendField(row.status, fields.status);
  if (fields.remarks) row.remarks = appendField(row.remarks, fields.remarks);
}

function startAccumRow(fields: Partial<Record<ColumnKey, string>>): AccumRow | null {
  const snoCodeText = fields.snoCode ?? "";
  const parsed = parseSnoCode(snoCodeText);
  if (!parsed?.code) return null;
  return {
    employeeCode: parsed.code,
    employeeName: fields.name ?? "",
    shift: fields.shift ?? "",
    inTime: fields.inTime ?? "",
    outTime: fields.outTime ?? "",
    workDuration: fields.workDuration ?? "",
    ot: fields.ot ?? "",
    status: fields.status ?? "",
    remarks: fields.remarks ?? "",
  };
}

function isIgnorableRow(row: ClusterRow): boolean {
  const t = normalizeSpaces(row.cells.map((c) => c.text).join(" "));
  if (!t) return true;
  if (/^page\s*no\.?/i.test(t)) return true;
  if (/^generated\s+by\b/i.test(t)) return true;
  if (/^printed\s+on\b/i.test(t)) return true;
  if (/^daily\s+attendance\s+report\b/i.test(t)) return true;
  if (/^attendance\s+date\b/i.test(t)) return true;
  if (/^department\b/i.test(t)) return true;
  if (/^company\s*:/i.test(t)) return true;
  if (/\bto\b/i.test(t) && /\d{4}/.test(t) && t.length < 40) return true;
  return false;
}

/**
 * True when the PDF looks like an eSSL Daily Attendance (Basic Report).
 */
export function looksLikeEsslDailyBasicPdf(
  document: PdfDocument,
  mergedText?: string
): boolean {
  const corpus = normalizeSpaces(
    `${mergedText ?? ""} ${document.pages.map((p) => p.text).join(" ")}`
  ).toLowerCase();

  if (/daily\s+attendance\s+report\s*\(\s*basic\s+report\s*\)/.test(corpus)) {
    return true;
  }

  for (const page of document.pages) {
    const rows = clusterPageItems(page.items);
    for (const row of rows) {
      if (isEsslDailyHeaderRow(row) && extractHeaderAnchors(row)) return true;
    }
  }

  return (
    /\bsno\b/.test(corpus) &&
    /\be\.?\s*code\b/.test(corpus) &&
    /\bintime\b/.test(corpus) &&
    /\bouttime\b/.test(corpus)
  );
}

function parsePageRows(
  page: PdfPage,
  fallbackAnchors: ColumnAnchor[] | null
): { anchors: ColumnAnchor[] | null; rows: AccumRow[] } {
  const clusters = clusterPageItems(page.items);
  let anchors = fallbackAnchors;
  const rows: AccumRow[] = [];
  let current: AccumRow | null = null;

  const flush = () => {
    if (current) {
      rows.push(current);
      current = null;
    }
  };

  for (const cluster of clusters) {
    if (isEsslDailyHeaderRow(cluster)) {
      const next = extractHeaderAnchors(cluster);
      if (next) {
        flush();
        anchors = next;
      }
      continue;
    }
    if (!anchors) continue;
    if (isIgnorableRow(cluster)) continue;

    if (isDataRowStart(cluster, anchors)) {
      flush();
      const fields = cellsToFields(cluster.cells, anchors);
      current = startAccumRow(fields);
      continue;
    }

    if (current) {
      const fields = cellsToFields(cluster.cells, anchors);
      mergeContinuation(current, fields);
    }
  }

  flush();
  return { anchors, rows };
}

/**
 * Parse eSSL Daily Attendance Report (Basic Report) using column X geometry.
 * Handles wrapped shift labels (Morning/Evening) and missing In/Out on Absent rows.
 */
export function parseEsslDailyBasicPdf(
  document: PdfDocument
): AttendanceImportParseResult {
  let anchors: ColumnAnchor[] | null = null;
  const accumulated: AccumRow[] = [];

  for (const page of document.pages) {
    const parsed = parsePageRows(page, anchors);
    if (parsed.anchors) anchors = parsed.anchors;
    accumulated.push(...parsed.rows);
  }

  if (!anchors) {
    return { ok: false, error: ESSL_DAILY_PDF_IMPORT_ERRORS.NO_HEADER };
  }
  if (accumulated.length === 0) {
    return { ok: false, error: ESSL_DAILY_PDF_IMPORT_ERRORS.NO_ROWS };
  }

  const rows: AttendanceImportRow[] = accumulated.map((r) => ({
    employeeCode: r.employeeCode,
    employeeName: r.employeeName,
    shift: r.shift,
    inTime: r.inTime,
    outTime: r.outTime,
    workDuration: r.workDuration,
    ot: r.ot,
    status: r.status,
    remarks: r.remarks,
    source: "PDF_DAILY",
  }));

  return { ok: true, rows };
}
