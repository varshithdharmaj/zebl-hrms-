/**
 * Positional PDF line reconstruction for cases where PDF.js emits almost no hasEOL markers.
 * PDF coordinates: origin bottom-left; larger Y is higher on the page.
 */

export type PdfTextItemLike = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  hasEOL?: boolean;
};

/** Prefer hasEOL text unless the document is essentially one flattened blob. */
export function shouldUsePositionalPdfReconstruction(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 400) return false;
  const newlines = (trimmed.match(/\n/g) ?? []).length;
  return newlines < 3;
}

/**
 * Group text items into reading-order lines using approximate Y bands, then X order.
 * Pages are joined with a single newline (no blank page separators).
 */
export function reconstructPdfTextFromItems(
  pages: readonly PdfTextItemLike[][]
): string {
  const pageTexts: string[] = [];

  for (const pageItems of pages) {
    const usable = pageItems.filter((item) => item.str.trim().length > 0);
    if (usable.length === 0) continue;

    const medianFont =
      median(usable.map((item) => item.fontSize).filter((n) => n > 0)) || 10;
    const yTol = Math.max(2, medianFont * 0.35);

    type Bucket = { y: number; items: PdfTextItemLike[] };
    const buckets: Bucket[] = [];

    for (const item of usable) {
      let bucket = buckets.find((b) => Math.abs(b.y - item.y) <= yTol);
      if (!bucket) {
        bucket = { y: item.y, items: [] };
        buckets.push(bucket);
      }
      bucket.items.push(item);
      // Keep bucket Y as the average of members for stability.
      bucket.y =
        bucket.items.reduce((sum, row) => sum + row.y, 0) / bucket.items.length;
    }

    const lines = buckets
      .sort((a, b) => b.y - a.y)
      .map((bucket) => joinLineItems(bucket.items, medianFont))
      .filter(Boolean);

    if (lines.length > 0) {
      pageTexts.push(lines.join("\n"));
    }
  }

  return pageTexts.join("\n");
}

function joinLineItems(items: PdfTextItemLike[], medianFont: number): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let out = "";
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    if (i === 0) {
      out = cur.str;
      continue;
    }
    const prev = sorted[i - 1]!;
    const gap = cur.x - (prev.x + prev.width);
    const needsSpace =
      gap > Math.max(1.2, medianFont * 0.12) &&
      !/\s$/.test(out) &&
      !/^\s/.test(cur.str);
    out += (needsSpace ? " " : "") + cur.str;
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}
