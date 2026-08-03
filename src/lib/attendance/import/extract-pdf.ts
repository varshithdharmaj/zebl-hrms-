import "server-only";

import { extractTextItems, getDocumentProxy } from "unpdf";
import type {
  AttendancePdfExtraction,
  PdfTextItem,
} from "./pdf-document";
import { buildPdfDocument, toMergedPdfTextFromDocument } from "./pdf-extraction-adapters";

/** Copy into a plain ArrayBuffer-backed Uint8Array for PDF.js worker transfer. */
export function toTransferablePdfBytes(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

type UnpdfStructuredItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  dir: string;
  hasEOL: boolean;
};

function mapUnpdfItem(item: UnpdfStructuredItem): PdfTextItem {
  return {
    text: item.str,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    fontSize: item.fontSize,
    fontFamily: item.fontFamily,
    dir: item.dir,
    hasEOL: item.hasEOL,
  };
}

/**
 * Read the PDF once via unpdf `extractTextItems`, then expose:
 * - structured `PdfDocument` (pages + items) for future Summary parsing
 * - `mergedText` adapter matching prior `extractText({ mergePages: true })`
 *
 * Does not parse attendance, detect sections, or write to the DB.
 */
export async function extractAttendancePdf(
  bytes: Uint8Array
): Promise<AttendancePdfExtraction> {
  const proxy = await getDocumentProxy(toTransferablePdfBytes(bytes));
  const { totalPages, items } = await extractTextItems(proxy);

  const pageItemArrays: PdfTextItem[][] = Array.from(
    { length: Math.max(0, totalPages) },
    (_, i) => {
      const pageItems = (items[i] ?? []) as UnpdfStructuredItem[];
      return pageItems.map(mapUnpdfItem);
    }
  );

  const document = buildPdfDocument(pageItemArrays);

  return {
    document,
    mergedText: toMergedPdfTextFromDocument(document),
  };
}
