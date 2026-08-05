import { describe, expect, it, vi } from "vitest";
import {
  buildReportCsv,
  buildReportExcel,
  buildReportHtml,
  buildReportExport,
} from "@/lib/recruitment/reports/export";
import { toReportFilters, filtersToSearchParams } from "@/lib/recruitment/reports/parse-filters";
import type { ReportBundle } from "@/lib/recruitment/reports/types";

vi.mock("@/lib/recruitment/config/feature-flags", () => ({
  isRecruitmentModuleEnabled: () => true,
}));

const sampleBundle: ReportBundle = {
  section: "hiring",
  title: "Hiring Reports",
  description: "Test",
  generatedAt: "2026-08-05T10:00:00.000Z",
  filters: { days: 30 },
  kpis: [
    { label: "Open jobs", value: 4 },
    { label: "Applications", value: 20 },
  ],
  charts: [],
  tables: [
    {
      id: "department-hiring",
      title: "Department Hiring",
      columns: [
        { key: "department", label: "Department" },
        { key: "offers", label: "Offers" },
      ],
      rows: [
        { id: "eng", department: "Engineering", offers: 5 },
        { id: "hr", department: "HR", offers: 2 },
      ],
    },
  ],
};

describe("recruitment report filters", () => {
  it("parses date and dimension filters", () => {
    const filters = toReportFilters({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      department: "Engineering",
      recruiterUserId: "user-1",
      search: "Ada",
      days: "30",
    });
    expect(filters.department).toBe("Engineering");
    expect(filters.recruiterUserId).toBe("user-1");
    expect(filters.search).toBe("Ada");
    expect(filters.days).toBe(30);
    expect(filters.dateRange?.startDate).toBeInstanceOf(Date);
  });

  it("serializes filters to search params", () => {
    const params = filtersToSearchParams({
      department: "Engineering",
      days: 30,
      dateRange: {
        startDate: new Date("2026-08-01T00:00:00.000Z"),
      },
    });
    expect(params.get("department")).toBe("Engineering");
    expect(params.get("days")).toBe("30");
    expect(params.get("startDate")).toBe("2026-08-01");
  });
});

describe("recruitment report exports", () => {
  it("builds CSV including table headers and rows", () => {
    const csv = buildReportCsv(sampleBundle);
    expect(csv).toContain("Hiring Reports");
    expect(csv).toContain("Department Hiring");
    expect(csv).toContain("Engineering");
    expect(csv).toContain("Offers");
  });

  it("exports only selected rows when provided", () => {
    const csv = buildReportCsv(sampleBundle, {
      tableId: "department-hiring",
      selectedRowIds: ["hr"],
    });
    expect(csv).toContain("HR");
    expect(csv).not.toContain("Engineering");
  });

  it("builds excel buffer", () => {
    const buffer = buildReportExcel(sampleBundle);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(100);
  });

  it("builds printable html for pdf/print", () => {
    const html = buildReportHtml(sampleBundle, { printable: true });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Hiring Reports");
    expect(html).toContain("window.print()");
  });

  it("returns mime and filename for export formats", () => {
    const csv = buildReportExport(sampleBundle, "csv");
    expect(csv.mimeType).toContain("text/csv");
    expect(csv.filename).toContain(".csv");

    const xlsx = buildReportExport(sampleBundle, "xlsx");
    expect(xlsx.mimeType).toContain("spreadsheetml");
    expect(xlsx.filename).toContain(".xlsx");

    const pdf = buildReportExport(sampleBundle, "pdf");
    expect(pdf.mimeType).toContain("text/html");
    expect(typeof pdf.data).toBe("string");
  });
});
