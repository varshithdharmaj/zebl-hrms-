import type { PdfDocument, PdfPage, PdfTextItem } from "./pdf-document";

/**
 * Rebuild page text the same way unpdf `getPageText` does:
 * join item strings, appending `\n` when `hasEOL` is set.
 */
export function pageTextFromItems(items: readonly PdfTextItem[]): string {
  return items.map((item) => item.text + (item.hasEOL ? "\n" : "")).join("");
}

/**
 * Legacy merged string identical to unpdf `extractText(..., { mergePages: true })`.
 * Must stay bit-compatible with the Daily PDF path.
 */
export function toMergedPdfText(pageTexts: readonly string[]): string {
  return pageTexts.join("\n").replace(/\s+/g, " ");
}

export function toMergedPdfTextFromDocument(document: PdfDocument): string {
  return toMergedPdfText(document.pages.map((p) => p.text));
}

/**
 * Build a structured document from per-page item arrays (1-based page numbers).
 * Does not interpret layout — geometry is passed through as-is.
 */
export function buildPdfDocument(
  pageItems: readonly (readonly PdfTextItem[])[]
): PdfDocument {
  const pages: PdfPage[] = pageItems.map((items, index) => {
    const list = [...items];
    return {
      pageNumber: index + 1,
      text: pageTextFromItems(list),
      items: list,
    };
  });

  return {
    totalPages: pages.length,
    pages,
  };
}
