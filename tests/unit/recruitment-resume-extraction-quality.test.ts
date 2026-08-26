import { describe, expect, it } from "vitest";
import { assessExtractionQuality } from "@/lib/recruitment/resume-import/parser/extraction-quality";

describe("assessExtractionQuality", () => {
  it("flags empty text as untrustworthy (scanned/image PDF case)", () => {
    const result = assessExtractionQuality("");
    expect(result.trustworthy).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("flags near-empty garbled text as untrustworthy", () => {
    const result = assessExtractionQuality("   \n\n  ");
    expect(result.trustworthy).toBe(false);
  });

  it("flags text with a low alphabetic ratio (likely garbled extraction)", () => {
    const garbled = "#@$%^&*()_+ ".repeat(20) + "1234567890";
    const result = assessExtractionQuality(garbled);
    expect(result.trustworthy).toBe(false);
    expect(result.metrics.alphaRatio).toBeLessThan(0.55);
  });

  it("accepts a normal headed resume with section headings and contact info", () => {
    const text = `John Smith
john.smith@example.com | +1 555 123 4567

EXPERIENCE
Software Engineer at Example Corp, 2020 - Present
Built and maintained backend services.

EDUCATION
B.Tech Computer Science, Example University, 2016 - 2020

SKILLS
JavaScript, TypeScript, Node.js`;
    const result = assessExtractionQuality(text);
    expect(result.trustworthy).toBe(true);
    expect(result.metrics.hasEmail).toBe(true);
    expect(result.metrics.hasSectionHeading).toBe(true);
  });

  it("accepts a long headerless narrative resume with contact info (does not require headings when body is substantial)", () => {
    const text = `
Name: Test Candidate
Mobile: 9000000000
Email: test.candidate@example.com

To seek a challenging career in the field of human resource by using the best
of my ability and skills which would result in the productive growth of the
organization I work for, across recruitment and staffing functions.

M. Pharmacy from Example College of Pharmacy with 82.56%.
Worked as HR Recruiter at Example Solutions Pvt Ltd 2024 to 2026.
Handling end-to-end recruitment process for IT and non-IT roles across
multiple client accounts and geographies, including sourcing, screening,
scheduling, and offer management responsibilities on a daily basis.
`;
    const result = assessExtractionQuality(text);
    expect(result.trustworthy).toBe(true);
  });

  it("does not judge semantic correctness — a short but well-formed, contactable snippet still passes structural gates it satisfies", () => {
    // The gate only asserts EXTRACTION trustworthiness, not parse completeness;
    // this text has a heading + contact info even though it is short.
    const text = `EXPERIENCE
Contact: jane@example.com`;
    const result = assessExtractionQuality(text);
    expect(result.metrics.hasEmail).toBe(true);
    expect(result.metrics.hasSectionHeading).toBe(true);
  });
});
