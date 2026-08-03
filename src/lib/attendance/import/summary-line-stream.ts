import type { PdfDocument, PdfPage, PdfTextItem } from "./pdf-document";

/**
 * One logical text line from a Summary PDF, preserving page boundaries.
 * Built from page text (hasEOL) when present; otherwise clustered by Y from items.
 */
export type SummarySourceLine = {
  pageNumber: number;
  text: string;
  /** PDF.js Y when derived from items (higher = top on typical pages). */
  y?: number;
};

const Y_CLUSTER_TOLERANCE = 3;

function linesFromPageText(page: PdfPage): SummarySourceLine[] {
  const raw = page.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return raw
    .split("\n")
    .map((t) => t.replace(/[ \t]+$/g, "").replace(/^[ \t]+/g, ""))
    .filter((t) => t.length > 0)
    .map((text) => ({ pageNumber: page.pageNumber, text }));
}

function linesFromPageItems(page: PdfPage): SummarySourceLine[] {
  if (page.items.length === 0) return [];

  // PDF.js Y increases upward — sort top-to-bottom (descending Y), then left-to-right.
  const sorted = [...page.items].sort((a, b) => {
    if (Math.abs(b.y - a.y) > Y_CLUSTER_TOLERANCE) return b.y - a.y;
    return a.x - b.x;
  });

  const clusters: { y: number; items: PdfTextItem[] }[] = [];
  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(last.y - item.y) <= Y_CLUSTER_TOLERANCE) {
      last.items.push(item);
    } else {
      clusters.push({ y: item.y, items: [item] });
    }
  }

  return clusters
    .map((cluster) => {
      const text = cluster.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      return { pageNumber: page.pageNumber, text, y: cluster.y };
    })
    .filter((l) => l.text.length > 0);
}

/**
 * Flatten a PdfDocument into ordered lines without merging pages into one string blob.
 * Prefers newline-preserving page.text; falls back to geometry clustering per page.
 */
export function buildSummaryLineStream(document: PdfDocument): SummarySourceLine[] {
  const lines: SummarySourceLine[] = [];
  for (const page of document.pages) {
    const fromText = linesFromPageText(page);
    if (fromText.length > 0) {
      lines.push(...fromText);
      continue;
    }
    lines.push(...linesFromPageItems(page));
  }
  return lines;
}
