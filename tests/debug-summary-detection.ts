import { detectAttendanceReportType } from "../src/lib/attendance/import/detect-report-type.ts";
import { toMergedPdfText } from "../src/lib/attendance/import/pdf-extraction-adapters.ts";
import {
  buildSummaryPdfDocumentFromLines,
  employeeSection,
  ESSL_SUMMARY_TABLE_HEADER,
} from "./fixtures/essl-summary-pdf.ts";

function hasDailyFlatHeaderSignals(corpus: string): boolean {
  const h = corpus;
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

function analyze(label: string, text: string, pageCount = 1) {
  const corpus = text.replace(/\s+/g, " ").trim().toLowerCase();
  const det = detectAttendanceReportType({
    format: "pdf",
    fileName: "report.pdf",
    extractedText: text,
  });
  const signals = {
    pageCount,
    first1000: text.replace(/\s+/g, " ").slice(0, 1000),
    hasSummaryReport: /\bsummary\s+report\b/i.test(text),
    hasAttendanceSummary: /\battendance\s+summary\b/i.test(text),
    has15DaySummary: /\b(15\s*-?\s*days?|monthly)\s+summary\b/i.test(corpus),
    hasDailyAttendance: /\bdaily\s+attendance\b/i.test(corpus),
    totalsHits: (corpus.match(/\btotals?\b/g) || []).length,
    hasEmployeeCodeColon: /\bemployee\s+code\s*[:#]/i.test(text),
    hasEmployeeCodeNamePair: /\bemployee\s+code\b.{0,40}\bemployee\s+name\b/i.test(corpus),
    dailyFlatOnFullCorpus: hasDailyFlatHeaderSignals(corpus),
  };

  const mode =
    det.type === "PDF_SUMMARY"
      ? "summary"
      : det.type === "UNKNOWN"
        ? "unknown"
        : "date";

  console.log("\n===", label, "===");
  console.log(
    JSON.stringify(
      {
        reportType: det.type,
        reasons: det.reasons,
        ui: {
          reportType: det.type,
          showAttendanceDate: mode === "date" || mode === "unknown",
          isSummary: det.type === "PDF_SUMMARY",
          isDaily: det.type === "PDF_DAILY" || det.type === "EXCEL_DAILY",
          isUnknown: det.type === "UNKNOWN",
          fieldMode: mode,
        },
        signals,
      },
      null,
      2
    )
  );
}

const dayRows = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return `${d}-Jul-2026  09:00  18:00  GS  09:00  Present`;
  });

// A
{
  const pages = [
    [
      "Summary Report",
      "Company XYZ",
      ...employeeSection({
        code: "660001",
        name: "Alice",
        rows: dayRows(2),
      }),
      ...employeeSection({
        code: "660002",
        name: "Bob",
        rows: dayRows(1),
      }),
    ],
  ];
  const doc = buildSummaryPdfDocumentFromLines(pages);
  const merged = toMergedPdfText(doc.pages.map((p) => p.text));
  analyze("A fixture Summary Report + 2 employees (mergedText)", merged, doc.totalPages);
}

// B — 15-day no title
{
  const pages = [
    [
      ...employeeSection({ code: "660001", name: "Alice", rows: dayRows(15) }),
      ...employeeSection({ code: "660002", name: "Bob", rows: dayRows(15) }),
    ],
  ];
  const doc = buildSummaryPdfDocumentFromLines(pages);
  analyze(
    "B 15-day 2-emp NO title (merged)",
    toMergedPdfText(doc.pages.map((p) => p.text)),
    doc.totalPages
  );
}

// C FORMAT2
{
  const fmt2 = [
    "Summary Report (15 days / month)",
    "Employee Code",
    "660001",
    "Employee Name",
    "Alice",
    ESSL_SUMMARY_TABLE_HEADER,
    "01-Jul-2026 09:00 18:00 GS 09:00 Present",
    "Totals",
    "Employee Code",
    "660002",
    "Employee Name",
    "Bob",
    ESSL_SUMMARY_TABLE_HEADER,
    "01-Jul-2026 09:00 18:00 GS 09:00 Present",
    "Totals",
  ].join("\n");
  analyze("C FORMAT2 with title", toMergedPdfText([fmt2]));
}

// D title without summary word
{
  const noSum = [
    "15 Days Attendance Report",
    "Employee Code: 660001",
    "Employee Name: Alice",
    ESSL_SUMMARY_TABLE_HEADER,
    ...dayRows(15),
    "Totals",
    "Employee Code: 660002",
    "Employee Name: Bob",
    ESSL_SUMMARY_TABLE_HEADER,
    ...dayRows(3),
    "Totals",
  ].join("\n");
  analyze("D 15 Days Attendance Report (no summary word)", toMergedPdfText([noSum]));
}

// E E.Code style
{
  const ecode = [
    "Attendance Sheet",
    "E.Code 660001 Name Alice",
    "Date In Time Out Time Shift Total Duration Status Remarks",
    "01-Jul-2026 09:00 18:00 GS 09:00 Present",
    "Total",
    "E.Code 660002 Name Bob",
    "Date In Time Out Time Shift Total Duration Status Remarks",
    "01-Jul-2026 09:00 18:00 GS 09:00 Present",
    "Total",
  ].join("\n");
  analyze("E E.Code style", toMergedPdfText([ecode]));
}

// F contaminated
{
  const contaminated =
    "Summary Report\nDaily Attendance note\n" +
    employeeSection({
      code: "1",
      name: "A",
      rows: ["01-Jul-2026 09:00 18:00 GS 09:00 Present"],
    }).join("\n");
  analyze("F Summary + daily attendance phrase", toMergedPdfText([contaminated]));
}

// G empty
analyze("G empty", "   ");

// H: title only "15 Day Summary"
{
  const t = ["15 Day Summary", ...employeeSection({ code: "1", name: "A", rows: dayRows(2) })].join(
    "\n"
  );
  analyze("H 15 Day Summary title", toMergedPdfText([t]));
}

// I: period phrase that user might have — "15-day report" without summary
{
  const t = [
    "15-day report",
    "Employee Code: 1",
    "Employee Name: A",
    ESSL_SUMMARY_TABLE_HEADER,
    ...dayRows(15),
    "Totals",
    "Employee Code: 2",
    "Employee Name: B",
    ESSL_SUMMARY_TABLE_HEADER,
    ...dayRows(2),
    "Totals",
  ].join("\n");
  analyze("I literal '15-day report' title", toMergedPdfText([t]));
}
