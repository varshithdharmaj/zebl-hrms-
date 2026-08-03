import { startOfDay } from "@/lib/utils";
import type { PdfDocument } from "./pdf-document";
import { buildSummaryLineStream, type SummarySourceLine } from "./summary-line-stream";
import type { AttendanceImportParseResult, AttendanceImportRow } from "./types";

export const SUMMARY_PDF_IMPORT_ERRORS = {
  NO_SECTIONS:
    "This Summary PDF does not contain recognizable employee sections (Employee Code / Employee Name). Upload an eSSL Summary Attendance report, or export as Excel.",
  NO_ROWS:
    "This Summary PDF was recognized but no attendance date rows were found. Check that the report includes daily rows under each employee.",
  INVALID_STRUCTURE:
    "Unsupported or incomplete eSSL Summary PDF layout. Expected employee sections with a Date / In Time / Out Time table, then Totals. For unsupported reports, export as Excel.",
  EMPTY_DOCUMENT: "The Summary PDF has no extractable text lines.",
} as const;

type ParserState =
  | "SEARCH_EMPLOYEE"
  | "READ_EMPLOYEE_HEADER"
  | "READ_TABLE_HEADER"
  | "READ_ATTENDANCE_ROWS"
  | "SKIP_TOTALS";

type EmployeeContext = {
  employeeCode: string;
  employeeName: string;
};

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isIgnorableNoise(line: string): boolean {
  const t = normalizeSpaces(line);
  if (!t) return true;
  if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(t)) return true;
  if (/^confidential\b/i.test(t)) return true;
  if (/^printed\s+on\b/i.test(t)) return true;
  if (/^generated\s+on\b/i.test(t)) return true;
  if (/^company\s*:/i.test(t)) return true;
  if (/^branch\s*:/i.test(t)) return true;
  if (/^department\s*:/i.test(t)) return true;
  if (/^period\s*:/i.test(t)) return true;
  if (/^from\s+\d/i.test(t) && /\bto\b/i.test(t)) return true;
  // Standalone report titles (not employee data)
  if (/^(summary\s+report|attendance\s+summary|monthly\s+summary)\b/i.test(t)) {
    return true;
  }
  return false;
}

function isTotalsLine(line: string): boolean {
  const t = normalizeSpaces(line);
  return /^(grand\s+)?totals?\b/i.test(t);
}

function isTableHeaderLine(line: string): boolean {
  const t = normalizeSpaces(line).toLowerCase();
  const hasDate = /\bdate\b/.test(t);
  const hasIn = /\bin\s*time\b/.test(t) || /\bcheck\s*in\b/.test(t);
  const hasOut = /\bout\s*time\b/.test(t) || /\bcheck\s*out\b/.test(t);
  // Must not be a flat daily employee+code header
  const hasEmpCodeCol = /\bemployee\s+code\b/.test(t) || /\be\.?\s*code\b/.test(t);
  return hasDate && hasIn && hasOut && !hasEmpCodeCol;
}

function matchEmployeeCode(line: string): string | null {
  const t = normalizeSpaces(line);
  const labeled = t.match(/^employee\s+code\s*[:#.\-]\s*(.+)$/i);
  if (labeled) {
    const code = labeled[1].trim().split(/\s{2,}|\s+\|/)[0]?.trim() ?? "";
    return code || null;
  }
  // "Employee Code 660005" (single space before code token)
  const spaced = t.match(/^employee\s+code\s+([A-Za-z0-9._\-/]+)\s*$/i);
  if (spaced) return spaced[1].trim();
  return null;
}

function matchEmployeeName(line: string): string | null {
  const t = normalizeSpaces(line);
  const labeled = t.match(/^employee\s+name\s*[:#.\-]\s*(.+)$/i);
  if (labeled) return labeled[1].trim() || null;
  const spaced = t.match(/^employee\s+name\s+(.+)$/i);
  if (spaced) return spaced[1].trim() || null;
  return null;
}

function isEmployeeSectionStart(line: string): boolean {
  return matchEmployeeCode(line) !== null;
}

/** eSSL-style dates: 16-Jul-2026, 16-Jul-26, 01/07/2026, 01-07-2026 */
function parseSummaryDate(token: string): Date | null {
  const t = token.trim();
  let m = t.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = MONTHS[m[2].toLowerCase()];
    if (month === undefined || day < 1 || day > 31) return null;
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const d = startOfDay(new Date(year, month, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const d = startOfDay(new Date(year, month, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function looksLikeTimeToken(token: string): boolean {
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(token.trim());
}

function looksLikeDurationToken(token: string): boolean {
  const t = token.trim();
  if (looksLikeTimeToken(t)) return true;
  if (/^\d+(\.\d+)?$/.test(t)) return true;
  return false;
}

function splitRowCells(line: string): string[] {
  const raw = line.replace(/\r$/, "");
  if (raw.includes("|")) {
    return raw.split("|").map((c) => c.trim()).filter((c, i, arr) => !(c === "" && (i === 0 || i === arr.length - 1)));
  }
  if (raw.includes("\t")) {
    return raw.split("\t").map((c) => c.trim());
  }
  const trimmed = raw.trim();
  if (/\s{2,}/.test(trimmed)) {
    return trimmed.split(/\s{2,}/).map((c) => c.trim());
  }
  // Single-space fallback only when first token is a date (deterministic for eSSL compact rows)
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 1 && parseSummaryDate(parts[0])) {
    return parts;
  }
  return [trimmed];
}

type ParsedAttendanceLine = {
  attendanceDate: Date;
  inTime: string;
  outTime: string;
  shift: string;
  workDuration: string;
  status: string;
  remarks: string;
};

/**
 * Parse one attendance data line under an eSSL Summary table.
 * Column order: Date, In Time, Out Time, Shift, Total Duration, Status, Remarks
 * Missing Out Time / blank days are allowed when Status or remarks carry meaning.
 */
function parseAttendanceDataLine(line: string): ParsedAttendanceLine | null {
  const cells = splitRowCells(line);
  if (cells.length === 0) return null;

  const date = parseSummaryDate(cells[0] ?? "");
  if (!date) return null;

  // Compact single-space: Date [In] [Out] [Shift] [Dur] [Status...] [Remarks...]
  // Multi-space/pipe: aligned cells (empty Out Time preserved as "")
  let inTime = "";
  let outTime = "";
  let shift = "";
  let workDuration = "";
  let status = "";
  let remarks = "";

  if (cells.length === 1) {
    return {
      attendanceDate: date,
      inTime: "",
      outTime: "",
      shift: "",
      workDuration: "",
      status: "",
      remarks: "",
    };
  }

  const rest = cells.slice(1);

  // Classify remaining tokens positionally with empty-cell awareness
  // Expected: in, out, shift, duration, status, remarks...
  const knownStatuses =
    /^(present|absent|week\s*off|weekend|holiday|leave|half[\s-]?day|short\s*hours|on\s*leave|wo|hl|cl|sl|el|od|ms)$/i;

  if (rest.length >= 1 && (looksLikeTimeToken(rest[0]) || rest[0] === "")) {
    inTime = rest[0] === "" ? "" : rest[0];
    let i = 1;
    if (i < rest.length && (looksLikeTimeToken(rest[i]) || rest[i] === "")) {
      outTime = rest[i] === "" ? "" : rest[i];
      i++;
    }
    // Shift: non-time, non-status short token
    if (i < rest.length && rest[i] !== "" && !looksLikeTimeToken(rest[i]) && !knownStatuses.test(rest[i])) {
      // Could be duration if HH:MM — prefer shift when alphabetic / short code
      if (/^[A-Za-z][A-Za-z0-9._-]{0,11}$/.test(rest[i]) || /^(gs|general|morning|evening|night)$/i.test(rest[i])) {
        shift = rest[i];
        i++;
      }
    }
    if (i < rest.length && (looksLikeDurationToken(rest[i]) || rest[i] === "")) {
      workDuration = rest[i] === "" ? "" : rest[i];
      i++;
    }
    if (i < rest.length) {
      // Status may be multi-word when multi-space split failed; take until end as status+remarks
      if (knownStatuses.test(rest[i]) || rest.length - i <= 2) {
        status = rest[i] ?? "";
        i++;
        if (i < rest.length) remarks = rest.slice(i).join(" ");
      } else {
        // e.g. "Weekly Off" split as Weekly / Off
        status = rest.slice(i).join(" ");
      }
    }
  } else {
    // No in-time — status/remarks only (Weekend / Holiday / Leave)
    status = rest.join(" ");
  }

  return {
    attendanceDate: date,
    inTime,
    outTime,
    shift,
    workDuration,
    status: normalizeSpaces(status),
    remarks: normalizeSpaces(remarks),
  };
}

function toImportRow(
  employee: EmployeeContext,
  parsed: ParsedAttendanceLine
): AttendanceImportRow {
  return {
    employeeCode: employee.employeeCode,
    employeeName: employee.employeeName,
    shift: parsed.shift,
    inTime: parsed.inTime,
    outTime: parsed.outTime,
    workDuration: parsed.workDuration,
    ot: "",
    status: parsed.status,
    remarks: parsed.remarks,
    attendanceDate: parsed.attendanceDate,
    source: "PDF_SUMMARY",
  };
}

/**
 * Deterministic eSSL Summary Attendance PDF parser.
 * Operates on PdfDocument page lines (not merged text). State machine only —
 * no OCR, no arbitrary-layout heuristics.
 */
export function parseAttendancePdfSummary(
  document: PdfDocument
): AttendanceImportParseResult {
  const lines = buildSummaryLineStream(document);
  if (lines.length === 0) {
    return { ok: false, error: SUMMARY_PDF_IMPORT_ERRORS.EMPTY_DOCUMENT };
  }

  let state: ParserState = "SEARCH_EMPLOYEE";
  let employeeCtx: EmployeeContext | null = null;
  let sectionsFound = 0;
  const rows: AttendanceImportRow[] = [];

  const finishSection = (): void => {
    employeeCtx = null;
  };

  for (const line of lines) {
    const text = line.text;
    if (isIgnorableNoise(text)) continue;

    switch (state) {
      case "SEARCH_EMPLOYEE": {
        const code = matchEmployeeCode(text);
        if (code) {
          employeeCtx = { employeeCode: code, employeeName: "" };
          state = "READ_EMPLOYEE_HEADER";
        }
        break;
      }

      case "READ_EMPLOYEE_HEADER": {
        if (!employeeCtx) {
          state = "SEARCH_EMPLOYEE";
          break;
        }
        const name = matchEmployeeName(text);
        if (name) {
          employeeCtx = {
            employeeCode: employeeCtx.employeeCode,
            employeeName: name,
          };
          state = "READ_TABLE_HEADER";
          break;
        }
        // Another Employee Code before name — replace
        const code = matchEmployeeCode(text);
        if (code) {
          employeeCtx = { employeeCode: code, employeeName: "" };
          break;
        }
        // Table header may appear immediately if name was inline elsewhere
        if (isTableHeaderLine(text)) {
          sectionsFound++;
          state = "READ_ATTENDANCE_ROWS";
          break;
        }
        break;
      }

      case "READ_TABLE_HEADER": {
        if (isTableHeaderLine(text)) {
          sectionsFound++;
          state = "READ_ATTENDANCE_ROWS";
          break;
        }
        // Name might appear after code with blank lines already skipped
        if (employeeCtx && !employeeCtx.employeeName) {
          const name = matchEmployeeName(text);
          if (name) {
            employeeCtx = {
              employeeCode: employeeCtx.employeeCode,
              employeeName: name,
            };
            break;
          }
        }
        const code = matchEmployeeCode(text);
        if (code) {
          employeeCtx = { employeeCode: code, employeeName: "" };
          state = "READ_EMPLOYEE_HEADER";
          break;
        }
        break;
      }

      case "READ_ATTENDANCE_ROWS": {
        if (!employeeCtx) {
          state = "SEARCH_EMPLOYEE";
          break;
        }
        // Repeated table header after page break
        if (isTableHeaderLine(text)) {
          break;
        }
        if (isTotalsLine(text)) {
          state = "SKIP_TOTALS";
          break;
        }
        if (isEmployeeSectionStart(text)) {
          const code = matchEmployeeCode(text);
          if (code) {
            finishSection();
            employeeCtx = { employeeCode: code, employeeName: "" };
            state = "READ_EMPLOYEE_HEADER";
          }
          break;
        }
        const parsed = parseAttendanceDataLine(text);
        if (parsed) {
          rows.push(toImportRow(employeeCtx, parsed));
          break;
        }
        // Non-date noise inside table — ignore (footers already filtered)
        break;
      }

      case "SKIP_TOTALS": {
        if (isTotalsLine(text)) {
          break;
        }
        if (isEmployeeSectionStart(text)) {
          const code = matchEmployeeCode(text);
          if (code) {
            finishSection();
            employeeCtx = { employeeCode: code, employeeName: "" };
            state = "READ_EMPLOYEE_HEADER";
          }
          break;
        }
        if (isTableHeaderLine(text) && employeeCtx) {
          // Unusual: totals then more rows for same employee — accept
          state = "READ_ATTENDANCE_ROWS";
          break;
        }
        // Stay skipping until next employee; ignore residual total cells
        break;
      }

      default: {
        const _exhaustive: never = state;
        void _exhaustive;
        break;
      }
    }
  }

  if (sectionsFound === 0 && rows.length === 0) {
    // No table headers recognized — structure invalid / not eSSL summary
    const anyEmployeeLabel = lines.some((l) => isEmployeeSectionStart(l.text));
    if (!anyEmployeeLabel) {
      return { ok: false, error: SUMMARY_PDF_IMPORT_ERRORS.NO_SECTIONS };
    }
    return { ok: false, error: SUMMARY_PDF_IMPORT_ERRORS.INVALID_STRUCTURE };
  }

  if (sectionsFound === 0) {
    return { ok: false, error: SUMMARY_PDF_IMPORT_ERRORS.INVALID_STRUCTURE };
  }

  if (rows.length === 0) {
    return { ok: false, error: SUMMARY_PDF_IMPORT_ERRORS.NO_ROWS };
  }

  return { ok: true, rows };
}

/** Test helper: expose date parsing for unit coverage. */
export function parseEsslSummaryDateForTest(token: string): Date | null {
  return parseSummaryDate(token);
}

/** Test helper: expose attendance line parsing. */
export function parseEsslSummaryAttendanceLineForTest(
  line: string
): ParsedAttendanceLine | null {
  return parseAttendanceDataLine(line);
}

export type { SummarySourceLine };
