import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractAttendancePdf } from "@/lib/attendance/import/extract-pdf";
import { parseAttendancePdf } from "@/lib/attendance/import/parse-pdf";
import {
  looksLikeEsslDailyBasicPdf,
  parseEsslDailyBasicPdf,
} from "@/lib/attendance/import/parse-pdf-daily-essl";

const REAL_PDF = "C:/Users/ADMIN/Downloads/DailyAttendance_BasicReport.pdf";

describe("eSSL Daily Basic Report — real PDF", () => {
  it.skipIf(!existsSync(REAL_PDF))(
    "parses DailyAttendance_BasicReport.pdf end-to-end",
    async () => {
      const bytes = new Uint8Array(readFileSync(REAL_PDF));
      const result = await parseAttendancePdf(bytes, {
        fileName: "DailyAttendance_BasicReport.pdf",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.reportType).toBe("PDF_DAILY");
      expect(result.rows.length).toBeGreaterThanOrEqual(60);

      const madhukar = result.rows.find((r) => r.employeeCode === "660005");
      expect(madhukar).toMatchObject({
        employeeName: "Madhukar",
        shift: "GS",
        inTime: "08:10:29",
        outTime: "17:01:36",
        workDuration: "8:51",
        status: "Present",
      });

      const morning = result.rows.find((r) => r.employeeCode === "1");
      expect(morning?.shift).toBe("Morning");

      const absent = result.rows.find((r) => r.employeeCode === "66102");
      expect(absent).toMatchObject({
        status: "Absent",
        inTime: "",
        outTime: "",
      });

      const noOut = result.rows.find((r) => r.employeeCode === "660012");
      expect(noOut?.shift).toBe("Evening");
      expect(noOut?.status).toMatch(/Present.*OutPunch/i);
    }
  );

  it.skipIf(!existsSync(REAL_PDF))(
    "geometry parser alone matches extractAttendancePdf document",
    async () => {
      const bytes = new Uint8Array(readFileSync(REAL_PDF));
      const { document, mergedText } = await extractAttendancePdf(bytes);
      expect(looksLikeEsslDailyBasicPdf(document, mergedText)).toBe(true);
      const parsed = parseEsslDailyBasicPdf(document);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.rows.length).toBeGreaterThanOrEqual(60);
    }
  );
});
