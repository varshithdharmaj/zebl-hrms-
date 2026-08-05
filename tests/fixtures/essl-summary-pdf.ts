import type { PdfDocument, PdfPage, PdfTextItem } from "@/lib/attendance/import/pdf-document";

/**
 * Build a PdfDocument from per-page text lines (anonymized eSSL Summary fixtures).
 * Each line becomes page text with hasEOL; optional simple geometry items for clustering tests.
 */
export function buildSummaryPdfDocumentFromLines(
  pages: string[][],
  options: { includeItems?: boolean } = {}
): PdfDocument {
  const includeItems = options.includeItems ?? true;
  const pdfPages: PdfPage[] = pages.map((lines, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const text = lines.map((l) => `${l}\n`).join("");
    const items: PdfTextItem[] = [];
    if (includeItems) {
      let y = 800;
      for (const line of lines) {
        items.push({
          text: line,
          x: 40,
          y,
          width: Math.max(8, line.length * 5),
          height: 10,
          fontSize: 10,
          hasEOL: true,
        });
        y -= 14;
      }
    }
    return { pageNumber, text, items };
  });

  return {
    totalPages: pdfPages.length,
    pages: pdfPages,
  };
}

export const ESSL_SUMMARY_TABLE_HEADER =
  "Date  In Time  Out Time  Shift  Total Duration  Status  Remarks";

export function employeeSection(params: {
  code: string;
  name: string;
  rows: string[];
  includeTotals?: boolean;
}): string[] {
  const lines = [
    `Employee Code: ${params.code}`,
    `Employee Name: ${params.name}`,
    ESSL_SUMMARY_TABLE_HEADER,
    ...params.rows,
  ];
  if (params.includeTotals !== false) {
    lines.push("Totals");
  }
  return lines;
}
