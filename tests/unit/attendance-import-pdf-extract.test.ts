import { describe, expect, it } from "vitest";
import {
  buildPdfDocument,
  pageTextFromItems,
  toMergedPdfText,
  toMergedPdfTextFromDocument,
} from "@/lib/attendance/import/pdf-extraction-adapters";
import type { PdfTextItem } from "@/lib/attendance/import/pdf-document";

function item(
  text: string,
  opts: Partial<PdfTextItem> & { x?: number; y?: number } = {}
): PdfTextItem {
  return {
    text,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    width: opts.width,
    height: opts.height,
    hasEOL: opts.hasEOL,
    fontSize: opts.fontSize,
    fontFamily: opts.fontFamily,
    dir: opts.dir,
  };
}

describe("pdf extraction adapters (Phase 3A)", () => {
  it("rebuilds page text from items using hasEOL (unpdf getPageText semantics)", () => {
    const text = pageTextFromItems([
      item("Hello", { hasEOL: false }),
      item(" ", { hasEOL: false }),
      item("World", { hasEOL: true }),
      item("Line2", { hasEOL: false }),
    ]);
    expect(text).toBe("Hello World\nLine2");
  });

  it("merged text matches legacy extractText({ mergePages: true }) algorithm", () => {
    const page1 = "Employee Code\nAlice";
    const page2 = "EMP002\nBob";
    // Identical to: texts.join("\n").replace(/\s+/g, " ")
    const legacy = [page1, page2].join("\n").replace(/\s+/g, " ");
    expect(toMergedPdfText([page1, page2])).toBe(legacy);
    expect(toMergedPdfText([page1, page2])).toBe("Employee Code Alice EMP002 Bob");
  });

  it("preserves page boundaries in the structured document", () => {
    const document = buildPdfDocument([
      [item("PageOne", { x: 10, y: 700, hasEOL: true })],
      [item("PageTwo", { x: 10, y: 700, hasEOL: true }), item("More", { x: 50, y: 680 })],
    ]);

    expect(document.totalPages).toBe(2);
    expect(document.pages).toHaveLength(2);
    expect(document.pages[0].pageNumber).toBe(1);
    expect(document.pages[1].pageNumber).toBe(2);
    expect(document.pages[0].text).toContain("PageOne");
    expect(document.pages[1].text).toContain("PageTwo");
    expect(document.pages[0].text).not.toContain("PageTwo");
  });

  it("preserves text item geometry without interpreting layout", () => {
    const document = buildPdfDocument([
      [
        item("E. Code", { x: 40, y: 750, width: 30, height: 10, fontSize: 10, hasEOL: false }),
        item("660001", { x: 80, y: 750, width: 40, height: 10, hasEOL: true }),
      ],
    ]);

    expect(document.pages[0].items).toHaveLength(2);
    expect(document.pages[0].items[0]).toMatchObject({
      text: "E. Code",
      x: 40,
      y: 750,
      width: 30,
      height: 10,
      fontSize: 10,
    });
    expect(document.pages[0].items[1].text).toBe("660001");
  });

  it("derives merged text from the structured document in one adapter step", () => {
    const document = buildPdfDocument([
      [item("A", { hasEOL: true }), item("B", { hasEOL: false })],
      [item("C", { hasEOL: true })],
    ]);
    expect(toMergedPdfTextFromDocument(document)).toBe(
      toMergedPdfText(document.pages.map((p) => p.text))
    );
  });
});
