import { describe, expect, it } from "vitest";
import {
  looksLikeEsslDailyBasicPdf,
  parseEsslDailyBasicPdf,
} from "@/lib/attendance/import/parse-pdf-daily-essl";
import {
  buildEsslDailyBasicPdfDocument,
  ESSL_DAILY_COLUMN_X,
  esslDailyAbsentRow,
  esslDailyPresentRow,
} from "../fixtures/essl-daily-basic-pdf";

describe("parseEsslDailyBasicPdf", () => {
  it("parses present, absent, and wrapped Morning shift rows", () => {
    const document = buildEsslDailyBasicPdfDocument([
      [
        ...esslDailyPresentRow({
          sno: 1,
          code: "660012",
          name: "Gautham",
          shift: "Morning",
          inTime: "23:05:36",
          outTime: "10:09:02",
          work: "11:03",
        }),
        ...esslDailyPresentRow({
          sno: 2,
          code: "660005",
          name: "Madhukar",
          shift: "GS",
          inTime: "08:10:29",
          outTime: "17:01:36",
          work: "8:51",
        }),
        ...esslDailyAbsentRow({
          sno: 3,
          code: "66102",
          name: "Lohith",
          shift: "NS",
        }),
      ],
    ]);

    expect(looksLikeEsslDailyBasicPdf(document)).toBe(true);

    const result = parseEsslDailyBasicPdf(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      employeeCode: "660012",
      employeeName: "Gautham",
      shift: "Morning",
      inTime: "23:05:36",
      outTime: "10:09:02",
      workDuration: "11:03",
      status: "Present",
      source: "PDF_DAILY",
    });
    expect(result.rows[1].employeeCode).toBe("660005");
    expect(result.rows[1].shift).toBe("GS");
    expect(result.rows[2]).toMatchObject({
      employeeCode: "66102",
      employeeName: "Lohith",
      shift: "NS",
      inTime: "",
      outTime: "",
      workDuration: "00:00",
      status: "Absent",
    });
  });

  it("merges wrapped Evening shift and Status remarks fragments", () => {
    const x = ESSL_DAILY_COLUMN_X;
    const document = buildEsslDailyBasicPdfDocument([
      [
        [
          { text: "14 660012", x: x.snoCode + 6 },
          { text: "Gautham", x: x.name },
          { text: "Eveni", x: x.shift },
          { text: "18:06:10", x: x.inTime - 2 },
          { text: "9:24", x: x.workDuration + 1 },
          { text: "00:00", x: x.ot },
          { text: "9:24", x: x.totDur },
          { text: "Present (No", x: x.status },
        ],
        [
          { text: "ng", x: x.shift },
          { text: "OutPunch)", x: x.status },
        ],
      ],
    ]);

    const result = parseEsslDailyBasicPdf(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].shift).toBe("Evening");
    expect(result.rows[0].outTime).toBe("");
    expect(result.rows[0].inTime).toBe("18:06:10");
    expect(result.rows[0].status).toBe("Present (No OutPunch)");
  });

  it("parses rows across multiple pages with repeated headers", () => {
    const document = buildEsslDailyBasicPdfDocument([
      [
        ...esslDailyPresentRow({
          sno: 1,
          code: "A1",
          name: "Alice",
          shift: "GS",
          inTime: "09:00:00",
          outTime: "18:00:00",
          work: "9:00",
        }),
      ],
      [
        ...esslDailyPresentRow({
          sno: 2,
          code: "B2",
          name: "Bob",
          shift: "GS",
          inTime: "09:15:00",
          outTime: "17:00:00",
          work: "7:45",
        }),
      ],
    ]);

    const result = parseEsslDailyBasicPdf(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => r.employeeCode)).toEqual(["A1", "B2"]);
  });
});
