import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAttendanceReportMetadata,
  resolveAttendanceDateFieldMode,
} from "@/lib/attendance/import/report-metadata";

const extractAttendancePdf = vi.fn();

vi.mock("@/lib/attendance/import/extract-pdf", () => ({
  extractAttendancePdf: (...args: unknown[]) => extractAttendancePdf(...args),
}));

describe("buildAttendanceReportMetadata", () => {
  it("Excel Daily requires date", () => {
    const meta = buildAttendanceReportMetadata("EXCEL_DAILY");
    expect(meta.requiresAttendanceDate).toBe(true);
    expect(meta.datesFromFile).toBe(false);
    expect(meta.label).toBe("Excel Daily detected");
  });

  it("PDF Daily without extracted date requires form date", () => {
    const meta = buildAttendanceReportMetadata("PDF_DAILY");
    expect(meta.requiresAttendanceDate).toBe(true);
    expect(meta.datesFromFile).toBe(false);
    expect(meta.label).toBe("Daily Attendance PDF detected");
  });

  it("PDF Daily with extracted date uses file date", () => {
    const meta = buildAttendanceReportMetadata("PDF_DAILY", {
      detectedAttendanceDate: "2026-07-29",
    });
    expect(meta.requiresAttendanceDate).toBe(false);
    expect(meta.datesFromFile).toBe(true);
    expect(meta.detectedAttendanceDate).toBe("2026-07-29");
    expect(meta.label).toContain("date from file");
  });

  it("PDF Summary hides date / dates from file", () => {
    const meta = buildAttendanceReportMetadata("PDF_SUMMARY");
    expect(meta.requiresAttendanceDate).toBe(false);
    expect(meta.datesFromFile).toBe(true);
    expect(meta.label).toBe("Summary Attendance PDF detected");
  });

  it("Unknown requires date", () => {
    const meta = buildAttendanceReportMetadata("UNKNOWN");
    expect(meta.requiresAttendanceDate).toBe(true);
    expect(meta.datesFromFile).toBe(false);
  });
});

describe("resolveAttendanceDateFieldMode", () => {
  it("stays hidden with no file", () => {
    expect(
      resolveAttendanceDateFieldMode({
        hasFile: false,
        status: "idle",
        metadata: null,
      })
    ).toBe("hidden");
  });

  it("shows detecting while analyzing", () => {
    expect(
      resolveAttendanceDateFieldMode({
        hasFile: true,
        status: "detecting",
        metadata: null,
      })
    ).toBe("detecting");
  });

  it("Excel → date mode", () => {
    expect(
      resolveAttendanceDateFieldMode({
        hasFile: true,
        status: "ready",
        metadata: buildAttendanceReportMetadata("EXCEL_DAILY"),
      })
    ).toBe("date");
  });

  it("PDF Daily → date mode", () => {
    expect(
      resolveAttendanceDateFieldMode({
        hasFile: true,
        status: "ready",
        metadata: buildAttendanceReportMetadata("PDF_DAILY"),
      })
    ).toBe("date");
  });

  it("PDF Daily with detected date → summary mode (date hidden)", () => {
    expect(
      resolveAttendanceDateFieldMode({
        hasFile: true,
        status: "ready",
        metadata: buildAttendanceReportMetadata("PDF_DAILY", {
          detectedAttendanceDate: "2026-07-29",
        }),
      })
    ).toBe("summary");
  });

  it("PDF Summary → summary mode (date hidden)", () => {
    expect(
      resolveAttendanceDateFieldMode({
        hasFile: true,
        status: "ready",
        metadata: buildAttendanceReportMetadata("PDF_SUMMARY"),
      })
    ).toBe("summary");
  });

  it("Unknown → unknown mode (date shown)", () => {
    expect(
      resolveAttendanceDateFieldMode({
        hasFile: true,
        status: "ready",
        metadata: buildAttendanceReportMetadata("UNKNOWN"),
      })
    ).toBe("unknown");
  });

  it("error status → unknown mode (date shown)", () => {
    expect(
      resolveAttendanceDateFieldMode({
        hasFile: true,
        status: "error",
        metadata: buildAttendanceReportMetadata("UNKNOWN"),
      })
    ).toBe("unknown");
  });

  it("file cleared returns to hidden (replacement reset)", () => {
    expect(
      resolveAttendanceDateFieldMode({
        hasFile: false,
        status: "ready",
        metadata: buildAttendanceReportMetadata("PDF_SUMMARY"),
      })
    ).toBe("hidden");
  });
});

describe("getAttendanceReportMetadata", () => {
  beforeEach(() => {
    extractAttendancePdf.mockReset();
  });

  it("Excel → EXCEL_DAILY without PDF extract", async () => {
    const { getAttendanceReportMetadata } = await import(
      "@/lib/attendance/import/detect-upload-metadata"
    );
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
    const result = await getAttendanceReportMetadata({
      fileName: "attendance.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.reportType).toBe("EXCEL_DAILY");
    expect(result.metadata.requiresAttendanceDate).toBe(true);
    expect(extractAttendancePdf).not.toHaveBeenCalled();
  });

  it("PDF Daily → requires date", async () => {
    const { getAttendanceReportMetadata } = await import(
      "@/lib/attendance/import/detect-upload-metadata"
    );
    extractAttendancePdf.mockResolvedValue({
      mergedText: [
        "Daily Attendance Report",
        "Employee Code | Employee Name | Shift | In Time | Out Time | Work Duration | OT | Status | Remarks",
        "EMP001 | Alice | GS | 09:00 | 18:00 | 09:00 | 0 | Present |",
      ].join("\n"),
      document: { totalPages: 1, pages: [] },
    });
    const bytes = new TextEncoder().encode("%PDF-1.4 daily");
    const result = await getAttendanceReportMetadata({
      fileName: "daily.pdf",
      mimeType: "application/pdf",
      size: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.reportType).toBe("PDF_DAILY");
    expect(result.metadata.requiresAttendanceDate).toBe(true);
    expect(extractAttendancePdf).toHaveBeenCalledOnce();
  });

  it("PDF Daily with Attendance Date header → date from file", async () => {
    const { getAttendanceReportMetadata } = await import(
      "@/lib/attendance/import/detect-upload-metadata"
    );
    extractAttendancePdf.mockResolvedValue({
      mergedText: [
        "Daily Attendance Report (Basic Report)",
        "Attendance Date 29-Jul-2026",
        "SNo E. Code Name Shift InTime OutTime Work Dur. OT Tot. Dur. Status Remarks",
        "1 660005 Madhukar GS 08:10:29 17:01:36 8:51 00:00 8:51 Present",
      ].join("\n"),
      document: { totalPages: 1, pages: [] },
    });
    const bytes = new TextEncoder().encode("%PDF-1.4 daily-dated");
    const result = await getAttendanceReportMetadata({
      fileName: "DailyAttendance_BasicReport.pdf",
      mimeType: "application/pdf",
      size: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.reportType).toBe("PDF_DAILY");
    expect(result.metadata.requiresAttendanceDate).toBe(false);
    expect(result.metadata.datesFromFile).toBe(true);
    expect(result.metadata.detectedAttendanceDate).toBe("2026-07-29");
  });

  it("PDF Summary → date not required", async () => {
    const { getAttendanceReportMetadata } = await import(
      "@/lib/attendance/import/detect-upload-metadata"
    );
    extractAttendancePdf.mockResolvedValue({
      mergedText: [
        "Summary Report",
        "Employee Code 660005",
        "Employee Name Madhukar",
        "Date In Time Out Time Shift Total Duration Status Remarks",
        "01-07-2026 09:00 18:00 GS 09:00 Present",
        "Totals",
      ].join("\n"),
      document: { totalPages: 1, pages: [] },
    });
    const bytes = new TextEncoder().encode("%PDF-1.4 summary");
    const result = await getAttendanceReportMetadata({
      fileName: "summary.pdf",
      mimeType: "application/pdf",
      size: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.reportType).toBe("PDF_SUMMARY");
    expect(result.metadata.requiresAttendanceDate).toBe(false);
    expect(result.metadata.datesFromFile).toBe(true);
  });

  it("empty PDF extract → UNKNOWN with date required", async () => {
    const { getAttendanceReportMetadata } = await import(
      "@/lib/attendance/import/detect-upload-metadata"
    );
    extractAttendancePdf.mockResolvedValue({
      mergedText: "   ",
      document: { totalPages: 1, pages: [] },
    });
    const bytes = new TextEncoder().encode("%PDF-1.4 empty");
    const result = await getAttendanceReportMetadata({
      fileName: "empty.pdf",
      mimeType: "application/pdf",
      size: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.reportType).toBe("UNKNOWN");
    expect(result.metadata.requiresAttendanceDate).toBe(true);
  });

  it("extract failure → UNKNOWN with date required", async () => {
    const { getAttendanceReportMetadata } = await import(
      "@/lib/attendance/import/detect-upload-metadata"
    );
    extractAttendancePdf.mockRejectedValue(new Error("boom"));
    const bytes = new TextEncoder().encode("%PDF-1.4 fail");
    const result = await getAttendanceReportMetadata({
      fileName: "fail.pdf",
      mimeType: "application/pdf",
      size: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.reportType).toBe("UNKNOWN");
    expect(result.metadata.requiresAttendanceDate).toBe(true);
  });
});
