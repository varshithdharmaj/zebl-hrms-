import type { PdfDocument, PdfPage, PdfTextItem } from "@/lib/attendance/import/pdf-document";

/** Column X anchors matching eSSL Daily Attendance Basic Report layout. */
export const ESSL_DAILY_COLUMN_X = {
  snoCode: 17,
  name: 81,
  shift: 162,
  inTime: 191,
  outTime: 230,
  workDuration: 272,
  ot: 318,
  totDur: 353,
  status: 399,
  remarks: 471,
} as const;

type EsslDailyCell = { text: string; x: number };

/**
 * Build a PdfDocument with per-cell geometry for eSSL Daily Basic Report tests.
 * Rows may include wrap fragments (e.g. shift "Morni" then "ng" on next Y).
 */
export function buildEsslDailyBasicPdfDocument(
  pages: EsslDailyCell[][][],
  options: { title?: string } = {}
): PdfDocument {
  const title = options.title ?? "Daily Attendance Report (Basic Report)";
  const pdfPages: PdfPage[] = pages.map((rowGroups, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const items: PdfTextItem[] = [];
    let y = 750;

    items.push({ text: title, x: 210, y, width: 200, height: 10, hasEOL: true });
    y -= 28;

    const header: EsslDailyCell[] = [
      { text: "SNo E. Code", x: ESSL_DAILY_COLUMN_X.snoCode },
      { text: "Name", x: ESSL_DAILY_COLUMN_X.name },
      { text: "Shift", x: ESSL_DAILY_COLUMN_X.shift },
      { text: "InTime", x: ESSL_DAILY_COLUMN_X.inTime },
      { text: "OutTime", x: ESSL_DAILY_COLUMN_X.outTime },
      { text: "Work Dur.", x: ESSL_DAILY_COLUMN_X.workDuration },
      { text: "OT", x: ESSL_DAILY_COLUMN_X.ot },
      { text: "Tot. Dur.", x: ESSL_DAILY_COLUMN_X.totDur },
      { text: "Status", x: ESSL_DAILY_COLUMN_X.status },
      { text: "Remarks", x: ESSL_DAILY_COLUMN_X.remarks },
    ];
    for (const cell of header) {
      items.push({
        text: cell.text,
        x: cell.x,
        y,
        width: Math.max(8, cell.text.length * 4),
        height: 10,
        hasEOL: false,
      });
    }
    items[items.length - 1]!.hasEOL = true;
    y -= 18;

    for (const row of rowGroups) {
      for (const cell of row) {
        items.push({
          text: cell.text,
          x: cell.x,
          y,
          width: Math.max(8, cell.text.length * 4),
          height: 10,
          hasEOL: false,
        });
      }
      if (row.length > 0) items[items.length - 1]!.hasEOL = true;
      y -= 14;
    }

    const text = items.map((i) => i.text + (i.hasEOL ? "\n" : " ")).join("");
    return { pageNumber, text, items };
  });

  return { totalPages: pdfPages.length, pages: pdfPages };
}

/** Helper: full present row with optional wrap line for shift. */
export function esslDailyPresentRow(params: {
  sno: number;
  code: string;
  name: string;
  shift: string;
  inTime: string;
  outTime: string;
  work: string;
  ot?: string;
  status?: string;
}): EsslDailyCell[][] {
  const x = ESSL_DAILY_COLUMN_X;
  const status = params.status ?? "Present";
  const ot = params.ot ?? "00:00";

  // Wrap Morning/Evening like the real eSSL PDF
  if (params.shift === "Morning") {
    return [
      [
        { text: `${params.sno} ${params.code}`, x: x.snoCode + 10 },
        { text: params.name, x: x.name },
        { text: "Morni", x: x.shift },
        { text: params.inTime, x: x.inTime - 2 },
        { text: params.outTime, x: x.outTime - 2 },
        { text: params.work, x: x.workDuration + 1 },
        { text: ot, x: x.ot },
        { text: params.work, x: x.totDur },
        { text: status, x: x.status },
      ],
      [{ text: "ng", x: x.shift }],
    ];
  }

  if (params.shift === "Evening") {
    return [
      [
        { text: `${params.sno} ${params.code}`, x: x.snoCode + 10 },
        { text: params.name, x: x.name },
        { text: "Eveni", x: x.shift },
        { text: params.inTime, x: x.inTime - 2 },
        { text: params.outTime, x: x.outTime - 2 },
        { text: params.work, x: x.workDuration + 1 },
        { text: ot, x: x.ot },
        { text: params.work, x: x.totDur },
        { text: status, x: x.status },
      ],
      [{ text: "ng", x: x.shift }],
    ];
  }

  return [
    [
      { text: `${params.sno} ${params.code}`, x: x.snoCode + 10 },
      { text: params.name, x: x.name },
      { text: params.shift, x: x.shift },
      { text: params.inTime, x: x.inTime - 2 },
      { text: params.outTime, x: x.outTime - 2 },
      { text: params.work, x: x.workDuration + 1 },
      { text: ot, x: x.ot },
      { text: params.work, x: x.totDur },
      { text: status, x: x.status },
    ],
  ];
}

/** Absent rows omit InTime/OutTime cells (real eSSL layout). */
export function esslDailyAbsentRow(params: {
  sno: number;
  code: string;
  name: string;
  shift?: string;
}): EsslDailyCell[][] {
  const x = ESSL_DAILY_COLUMN_X;
  return [
    [
      { text: `${params.sno} ${params.code}`, x: x.snoCode + 10 },
      { text: params.name, x: x.name },
      { text: params.shift ?? "NS", x: x.shift },
      { text: "00:00", x: x.workDuration + 1 },
      { text: "00:00", x: x.ot },
      { text: "00:00", x: x.totDur },
      { text: "Absent", x: x.status },
    ],
  ];
}
