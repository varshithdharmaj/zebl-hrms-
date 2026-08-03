import type { AttendanceImportFormat, AttendanceReportType } from "./types";

/**
 * Inputs for conservative report-type detection.
 * Detection does not parse rows or write to the DB.
 */
export type DetectAttendanceReportInput = {
  /** Original upload file name (extension used when format is absent). */
  fileName?: string;
  /** Format from file-validation (preferred over extension alone). */
  format?: AttendanceImportFormat;
  /** Extracted PDF text (or Excel header probe text). Optional for Excel. */
  extractedText?: string;
  /** Known header cells when already available (Excel sheet / PDF line). */
  headers?: string[];
};

export type DetectAttendanceReportResult = {
  type: AttendanceReportType;
  /** Short signals used for the decision (debugging / tests). */
  reasons: string[];
};

function extensionOf(fileName: string): string {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot === -1 ? "" : lower.slice(dot);
}

function resolveFormat(
  input: DetectAttendanceReportInput
): AttendanceImportFormat | null {
  if (input.format === "excel" || input.format === "pdf") {
    return input.format;
  }
  const ext = input.fileName ? extensionOf(input.fileName) : "";
  if (ext === ".xlsx" || ext === ".xls") return "excel";
  if (ext === ".pdf") return "pdf";
  return null;
}

function normalizeBlob(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function headerBlob(headers: string[] | undefined): string {
  if (!headers || headers.length === 0) return "";
  return normalizeBlob(headers.join(" "));
}

function joinedCorpus(input: DetectAttendanceReportInput): string {
  const parts = [input.extractedText ?? "", headerBlob(input.headers)];
  return normalizeBlob(parts.filter(Boolean).join(" "));
}

/** Flat daily table: identity + in/out on the same header band. */
function hasDailyFlatHeaderSignals(corpus: string, headers?: string[]): boolean {
  const h = headerBlob(headers) || corpus;
  const hasCode =
    /\be\.?\s*code\b/.test(h) ||
    /\bemp\.?\s*code\b/.test(h) ||
    /\bemployee\s+code\b/.test(h);
  const hasName = /\bname\b/.test(h) || /\bemployee\s+name\b/.test(h);
  const hasIn = /\ba\.?\s*intime\b/.test(h) || /\bin\s*time\b/.test(h) || /\bcheck\s*in\b/.test(h);
  const hasOut =
    /\ba\.?\s*outtime\b/.test(h) || /\bout\s*time\b/.test(h) || /\bcheck\s*out\b/.test(h);
  return hasCode && hasName && hasIn && hasOut;
}

/**
 * Summary-style date table: Date + In/Out without employee identity columns
 * on the same header line.
 */
function hasSummaryDateTableHeader(headers: string[] | undefined, corpus: string): boolean {
  const h = headerBlob(headers);
  const band = h || corpus;
  const hasDate = /\bdate\b/.test(band);
  const hasIn = /\bin\s*time\b/.test(band) || /\bcheck\s*in\b/.test(band);
  const hasOut = /\bout\s*time\b/.test(band) || /\bcheck\s*out\b/.test(band);
  const hasCodeOnHeader =
    /\be\.?\s*code\b/.test(band) ||
    /\bemp\.?\s*code\b/.test(band) ||
    (Boolean(h) && /\bemployee\s+code\b/.test(h));
  // When only corpus is available, require explicit date-table wording near times
  // without a daily flat header.
  if (!h) {
    return (
      hasDate &&
      hasIn &&
      hasOut &&
      !hasDailyFlatHeaderSignals(corpus) &&
      (/\bdate\b.{0,80}\bin\s*time\b.{0,80}\bout\s*time\b/.test(corpus) ||
        /\bin\s*time\b.{0,80}\bout\s*time\b.{0,80}\b(total\s+duration|status|remarks)\b/.test(
          corpus
        ))
    );
  }
  return hasDate && hasIn && hasOut && !hasCodeOnHeader;
}

function looksLikePdfSummary(input: DetectAttendanceReportInput): {
  match: boolean;
  reasons: string[];
} {
  const corpus = joinedCorpus(input);
  const reasons: string[] = [];
  if (!corpus) return { match: false, reasons };

  // Daily title wins over weak summary cues
  if (/\bdaily\s+attendance\b/.test(corpus)) {
    return { match: false, reasons: ["daily-title-present"] };
  }

  if (/\bsummary\s+report\b/.test(corpus)) {
    reasons.push("title:summary-report");
  }
  if (/\b(15\s*-?\s*days?|monthly)\s+summary\b/.test(corpus)) {
    reasons.push("title:period-summary");
  }
  if (/\battendance\s+summary\b/.test(corpus)) {
    reasons.push("title:attendance-summary");
  }

  if (hasSummaryDateTableHeader(input.headers, corpus)) {
    reasons.push("structure:date-table-without-employee-columns");
  }

  // Sectioned employee reports often repeat Totals and surface code/name as labels
  const totalsHits = corpus.match(/\btotals?\b/g)?.length ?? 0;
  if (totalsHits >= 2) {
    reasons.push("structure:repeated-totals");
  }

  const sectionLabel =
    /\bemployee\s+code\b.{0,40}\bemployee\s+name\b/.test(corpus) ||
    /\bemployee\s+code\s*[:#]/.test(corpus);
  if (sectionLabel && (totalsHits >= 1 || hasSummaryDateTableHeader(input.headers, corpus))) {
    reasons.push("structure:employee-section-labels");
  }

  // Require a title cue OR strong sectioning (avoid false positives on flat dailies)
  const hasTitle = reasons.some((r) => r.startsWith("title:"));
  const hasDateTable = reasons.includes(
    "structure:date-table-without-employee-columns"
  );
  const hasRepeatedTotals = reasons.includes("structure:repeated-totals");
  const hasSectionLabels = reasons.includes("structure:employee-section-labels");
  const hasStructure =
    (hasDateTable && (hasRepeatedTotals || hasSectionLabels)) ||
    (hasSectionLabels && hasRepeatedTotals);

  return { match: hasTitle || hasStructure, reasons };
}

function looksLikePdfDaily(input: DetectAttendanceReportInput): {
  match: boolean;
  reasons: string[];
} {
  const corpus = joinedCorpus(input);
  const reasons: string[] = [];
  if (!corpus) return { match: false, reasons };

  if (/\bdaily\s+attendance\b/.test(corpus)) {
    reasons.push("title:daily-attendance");
  }
  if (/\bpunch\s+records?\b/.test(corpus)) {
    reasons.push("column:punch-records");
  }
  if (/\bs\.?\s*intime\b/.test(corpus) && /\ba\.?\s*intime\b/.test(corpus)) {
    reasons.push("column:scheduled-and-actual-intime");
  }
  if (hasDailyFlatHeaderSignals(corpus, input.headers)) {
    reasons.push("structure:flat-employee-day-header");
  }

  return { match: reasons.length > 0, reasons };
}

/**
 * Conservatively classify an attendance upload before parsing.
 * Prefer UNKNOWN / PDF_DAILY over false PDF_SUMMARY so existing daily flows stay intact.
 */
export function detectAttendanceReportType(
  input: DetectAttendanceReportInput
): DetectAttendanceReportResult {
  const format = resolveFormat(input);

  if (format === "excel") {
    return {
      type: "EXCEL_DAILY",
      reasons: ["format:excel"],
    };
  }

  if (format !== "pdf") {
    return {
      type: "UNKNOWN",
      reasons: ["format:unrecognized"],
    };
  }

  const corpus = joinedCorpus(input);
  if (!corpus) {
    return {
      type: "UNKNOWN",
      reasons: ["pdf:no-extractable-text"],
    };
  }

  const summary = looksLikePdfSummary(input);
  if (summary.match) {
    return {
      type: "PDF_SUMMARY",
      reasons: summary.reasons,
    };
  }

  const daily = looksLikePdfDaily(input);
  if (daily.match) {
    return {
      type: "PDF_DAILY",
      reasons: daily.reasons,
    };
  }

  // Unclassified PDF text: treat as daily candidate so the existing parser
  // remains the source of accept/reject (no behavior change in Phase 1).
  return {
    type: "PDF_DAILY",
    reasons: ["pdf:default-daily-candidate"],
  };
}
