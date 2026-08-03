/**
 * Structured PDF extraction model (Phase 3A).
 * Geometry is captured but not interpreted — no attendance parsing here.
 *
 * Fields mirror unpdf `StructuredTextItem` where available:
 * - text ← str
 * - x, y ← transform translation
 * - width, height, fontSize, fontFamily, dir, hasEOL
 */

export type PdfTextItem = {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  /** Text direction from PDF.js (`ltr` | `rtl` | `ttb`). */
  dir?: string;
  hasEOL?: boolean;
};

export type PdfPage = {
  pageNumber: number;
  /** Page text rebuilt from items (preserves hasEOL newlines). */
  text: string;
  items: PdfTextItem[];
};

export type PdfDocument = {
  totalPages: number;
  pages: PdfPage[];
};

export type AttendancePdfExtraction = {
  /** Page-bounded document with text items (future Summary parser input). */
  document: PdfDocument;
  /**
   * Legacy Daily-parser view — identical to unpdf
   * `extractText(pdf, { mergePages: true })`:
   * `pageTexts.join("\\n").replace(/\\s+/g, " ")`.
   */
  mergedText: string;
};
