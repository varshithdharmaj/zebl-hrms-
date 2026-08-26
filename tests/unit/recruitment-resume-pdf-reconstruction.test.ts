import { describe, expect, it } from "vitest";
import {
  reconstructPdfTextFromItems,
  shouldUsePositionalPdfReconstruction,
  type PdfTextItemLike,
} from "@/lib/recruitment/resume-import/parser/pdf-line-reconstruct";

/**
 * Regression fixture for the "Jahnavi" case: a two-column education table
 * where pdf.js's default hasEOL reading order groups all "Year" column
 * values into a trailing cluster, disconnected from their degree rows —
 * even though the hasEOL text has plenty of newlines overall.
 *
 * Coordinates are the real geometry observed from the production PDF that
 * exposed this bug (pure layout data, no candidate PII); text content is
 * genericized.
 */
const DESYNCED_HASEOL_TEXT = `PROFESSIONAL SUMMARY
HR Executive with experience managing end-to-end recruitment pipelines and
core HR operations, balancing candidate engagement with administrative
accuracy to drive efficient hiring workflows across multiple departments.

EDUCATION
Master of Business Administration
Human Resource | Example University
Degree
B.Sc. | Example Science College
Intermediate
Year
2023-2025
2020-2023
2018WORK EXPERIENCE`;

const ORDINARY_RESUME_TEXT = `PROFESSIONAL SUMMARY
Backend engineer with 5 years of experience building distributed systems.

EXPERIENCE
Senior Backend Engineer — Example Corp (2021 - Present)
Built and maintained payment processing services.

Backend Engineer — Other Corp (2018 - 2021)
Worked on the checkout team.

EDUCATION
B.Tech Computer Science, Example Institute of Technology, 2014 - 2018

SKILLS
Node.js, PostgreSQL, AWS`;

describe("shouldUsePositionalPdfReconstruction", () => {
  it("does not trigger for short text", () => {
    expect(shouldUsePositionalPdfReconstruction("short text")).toBe(false);
  });

  it("triggers on the classic 'almost no newlines' flattened-blob case", () => {
    const flat = "A".repeat(500);
    expect(shouldUsePositionalPdfReconstruction(flat)).toBe(true);
  });

  it("triggers on a desynced trailing date cluster even though newlines are plentiful", () => {
    expect(shouldUsePositionalPdfReconstruction(DESYNCED_HASEOL_TEXT)).toBe(true);
  });

  it("does not trigger for an ordinary, correctly-ordered multi-section resume", () => {
    expect(shouldUsePositionalPdfReconstruction(ORDINARY_RESUME_TEXT)).toBe(false);
  });

  it("does not false-positive on a single Present/current date appearing near a year", () => {
    const text = `EXPERIENCE
Software Engineer — Example Corp
2022
Present
Built things.
`.repeat(10);
    // A single bare "2022" / "Present" pair is plausible in sparse layouts;
    // only a run of >=2 consecutive bare-year lines should trigger.
    expect(shouldUsePositionalPdfReconstruction(text)).toBe(true);
  });
});

describe("reconstructPdfTextFromItems — Jahnavi-shaped desynced table", () => {
  it("reattaches the Year column to its correct row by Y-coordinate", () => {
    // Real coordinates captured from the production PDF that exposed the bug.
    const items: PdfTextItemLike[][] = [
      [
        { str: "Master", x: 39.4, y: 526.2, width: 36.6, height: 10, fontSize: 10 },
        { str: "of Business Administration", x: 77.9, y: 526.2, width: 139.6, height: 10, fontSize: 10 },
        { str: "Year", x: 533.5, y: 526.2, width: 23.4, height: 10, fontSize: 10 },
        { str: "Human Resource | Example University", x: 39.4, y: 509.7, width: 193.7, height: 10, fontSize: 10 },
        { str: "2023-2025", x: 501.0, y: 509.7, width: 56.0, height: 10, fontSize: 10 },
        { str: "Degree", x: 39.4, y: 493.2, width: 38.2, height: 10, fontSize: 10 },
        { str: "B.Sc. | Example Science College", x: 39.4, y: 476.7, width: 205.7, height: 10, fontSize: 10 },
        { str: "2020-2023", x: 500.0, y: 476.7, width: 56.9, height: 10, fontSize: 10 },
      ],
    ];

    const text = reconstructPdfTextFromItems(items);
    const lines = text.split("\n");

    expect(lines).toContain("Human Resource | Example University 2023-2025");
    expect(lines).toContain("B.Sc. | Example Science College 2020-2023");
  });
});
