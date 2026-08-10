import { describe, expect, it } from "vitest";
import {
  reconstructPdfTextFromItems,
  shouldUsePositionalPdfReconstruction,
} from "@/lib/recruitment/resume-import/parser/pdf-line-reconstruct";
import { matchSectionHeader } from "@/lib/recruitment/resume-import/parser/sections";
import { splitResumeLines } from "@/lib/recruitment/resume-import/parser/cleanup";

describe("pdf-line-reconstruct", () => {
  it("uses positional fallback only for flattened long text", () => {
    expect(shouldUsePositionalPdfReconstruction("short")).toBe(false);
    expect(
      shouldUsePositionalPdfReconstruction(`${"word ".repeat(100)}\n\n\nExtra`)
    ).toBe(false);
    expect(
      shouldUsePositionalPdfReconstruction("word ".repeat(120).trim())
    ).toBe(true);
  });

  it("reconstructs top-to-bottom lines without fragmenting a role block", () => {
    const text = reconstructPdfTextFromItems([
      [
        {
          str: "Professional Experience",
          x: 50,
          y: 700,
          width: 140,
          height: 12,
          fontSize: 12,
        },
        {
          str: "Senior Software Engineer — ABC Technologies",
          x: 50,
          y: 680,
          width: 260,
          height: 11,
          fontSize: 11,
        },
        {
          str: "Jan 2022 – Present",
          x: 50,
          y: 665,
          width: 100,
          height: 10,
          fontSize: 10,
        },
        {
          str: "Built APIs",
          x: 50,
          y: 650,
          width: 70,
          height: 10,
          fontSize: 10,
        },
        {
          str: "Skills: TypeScript, React, Next.js, PostgreSQL",
          x: 50,
          y: 620,
          width: 280,
          height: 10,
          fontSize: 10,
        },
      ],
    ]);

    expect(text).toBe(
      [
        "Professional Experience",
        "Senior Software Engineer — ABC Technologies",
        "Jan 2022 – Present",
        "Built APIs",
        "Skills: TypeScript, React, Next.js, PostgreSQL",
      ].join("\n")
    );

    const headers = splitResumeLines(text)
      .map((line) => matchSectionHeader(line))
      .filter(Boolean);
    expect(headers).toContain("experience");
  });

  it("joins same-line fragments with a space when x-gap is meaningful", () => {
    const text = reconstructPdfTextFromItems([
      [
        {
          str: "Current Company",
          x: 50,
          y: 500,
          width: 90,
          height: 10,
          fontSize: 10,
        },
        {
          str: "Acme Corp",
          x: 160,
          y: 501,
          width: 60,
          height: 10,
          fontSize: 10,
        },
      ],
    ]);
    expect(text).toBe("Current Company Acme Corp");
  });

  it("preserves page boundaries as newlines between pages", () => {
    const text = reconstructPdfTextFromItems([
      [
        {
          str: "Page One Skills",
          x: 50,
          y: 700,
          width: 80,
          height: 10,
          fontSize: 10,
        },
      ],
      [
        {
          str: "Education",
          x: 50,
          y: 700,
          width: 60,
          height: 10,
          fontSize: 10,
        },
      ],
    ]);
    expect(text.split("\n")).toEqual(["Page One Skills", "Education"]);
  });
});
