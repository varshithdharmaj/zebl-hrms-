import { describe, expect, it } from "vitest";
import {
  detectResumeDocumentKind,
  extractEmails,
  extractLinkedInUrls,
  extractPhones,
  normalizePhone,
  normalizeResumeDate,
  parseResumePlainText,
  parseResumeFromCleanText,
  normalizeParsedResumeDraft,
} from "@/lib/recruitment/resume-import/parser";
import { cleanupResumeText } from "@/lib/recruitment/resume-import/parser/cleanup";

const SAMPLE_RESUME = `
Jane Marie Doe
Bengaluru, India
jane.doe@example.com | +91 98765 43210
https://linkedin.com/in/janedoe

SUMMARY
Full-stack engineer with 6 years of experience building HR products.

EXPERIENCE
Senior Software Engineer at Northwind Labs
Jan 2022 – Present
Owned candidate profile workflows and document uploads.

Software Engineer at Contoso Soft
Jun 2019 – Dec 2021
Built internal REST APIs.

EDUCATION
B.Tech in Computer Science
State University
2015 – 2019

SKILLS
TypeScript, Node.js, React, PostgreSQL, TypeScript
`;

describe("resume parser patterns", () => {
  it("extracts email, phone, and linkedin", () => {
    const text = SAMPLE_RESUME;
    expect(extractEmails(text)[0]).toBe("jane.doe@example.com");
    expect(extractPhones(text)[0]).toMatch(/9876543210|919876543210|\+919876543210/);
    expect(extractLinkedInUrls(text)[0]).toMatch(/linkedin\.com\/in\/janedoe/i);
  });

  it("normalizes phones and dates", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("555-0100")).toBeNull();
    expect(normalizeResumeDate("Jan 2022")).toBe("2022-01-01");
    expect(normalizeResumeDate("03/2020")).toBe("2020-03-01");
    expect(normalizeResumeDate("2019")).toBe("2019-01-01");
    expect(normalizeResumeDate("Present")).toBeNull();
  });

  it("detects pdf and docx kinds", () => {
    expect(detectResumeDocumentKind("cv.pdf", "application/pdf")).toBe("pdf");
    expect(
      detectResumeDocumentKind(
        "cv.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe("docx");
    expect(detectResumeDocumentKind("cv.doc", "application/msword")).toBe("unsupported");
    expect(detectResumeDocumentKind("photo.png", "image/png")).toBe("unsupported");
  });
});

describe("parseResumeFromCleanText", () => {
  it("parses a structured multi-section resume", () => {
    const { draft, warnings } = parseResumeFromCleanText(SAMPLE_RESUME);
    const normalized = normalizeParsedResumeDraft(draft);

    expect(normalized.personal.fullName).toMatch(/Jane/i);
    expect(normalized.personal.email).toBe("jane.doe@example.com");
    expect(normalized.personal.linkedinUrl).toMatch(/linkedin\.com\/in\/janedoe/i);
    expect(normalized.professional.summary).toMatch(/Full-stack/i);
    expect(normalized.professional.totalExperienceYears).toBe("6");
    expect(normalized.experiences.length).toBeGreaterThanOrEqual(2);
    expect(normalized.experiences.some((e) => e.isCurrent)).toBe(true);
    expect(normalized.educations.length).toBeGreaterThanOrEqual(1);
    expect(normalized.educations[0]?.institution).toMatch(/State University/i);
    expect(normalized.skills).toContain("TypeScript");
    expect(normalized.skills.filter((s) => s.toLowerCase() === "typescript")).toHaveLength(1);
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("handles missing sections without crashing", () => {
    const text = `
Alex Rivera
alex@example.com
+1 555 0100 9999
`;
    const { draft } = parseResumeFromCleanText(text);
    expect(draft.personal.email).toBe("alex@example.com");
    expect(draft.experiences).toEqual([]);
    expect(draft.educations).toEqual([]);
    expect(draft.skills).toEqual([]);
  });

  it("handles empty resume", () => {
    const { draft, warnings } = parseResumeFromCleanText("   \n\n  ");
    expect(draft.personal.fullName).toBeNull();
    expect(warnings.some((w) => /no extractable text/i.test(w))).toBe(true);
  });

  it("parses multiple experiences and education entries", () => {
    const text = `
Sam Patel
sam@example.com

EXPERIENCE
Engineer at Alpha
2020 – 2021
Built APIs.

Engineer at Beta
2022 – Present
Led hiring tools.

EDUCATION
B.Sc Computer Science
City College
2016

MBA
Business School
2020

SKILLS
Go, Python, SQL
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.experiences.length).toBeGreaterThanOrEqual(2);
    expect(normalized.educations.length).toBeGreaterThanOrEqual(2);
    expect(normalized.skills.length).toBe(3);
  });

  it("dedupes duplicate skills and experiences", () => {
    const text = `
Casey Lee
casey@example.com

EXPERIENCE
Developer at Acme
2020 – 2021

Developer at Acme
2020 – 2021

SKILLS
React, react, Node.js, node.js
`;
    const { draft } = parseResumeFromCleanText(text);
    const normalized = normalizeParsedResumeDraft(draft);
    expect(normalized.experiences).toHaveLength(1);
    expect(normalized.skills.map((s) => s.toLowerCase()).sort()).toEqual([
      "node.js",
      "react",
    ]);
  });
});

describe("parseResumePlainText pipeline", () => {
  it("produces merge-engine-ready draft content", () => {
    const { result, draftContent } = parseResumePlainText(SAMPLE_RESUME, "doc-99");
    expect(result.ok).toBe(true);
    expect(draftContent.source).toBe("parser");
    expect(draftContent.documentId).toBe("doc-99");
    expect(draftContent.mapped.personal.email).toBe("jane.doe@example.com");
    expect(draftContent.mapped.projects).toEqual([]);
    expect(draftContent.mapped.certifications).toEqual([]);
    expect(draftContent.metadata.parserVersion).toBeTruthy();
  });

  it("returns structured error for empty text without throwing", () => {
    const { result, draftContent } = parseResumePlainText("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EMPTY_DOCUMENT");
    }
    expect(draftContent.mapped.personal.fullName).toBeNull();
  });
});

describe("cleanupResumeText", () => {
  it("collapses whitespace", () => {
    expect(cleanupResumeText("A\r\n\r\n\r\nB\t\tC")).toBe("A\n\nB C");
  });
});

describe("extractResumeText guards", () => {
  it("rejects unsupported and empty buffers via detect + plain pipeline", async () => {
    const { extractResumeText } = await import(
      "@/lib/recruitment/resume-import/parser/extract-text"
    );
    const unsupported = await extractResumeText({
      content: Buffer.from("hello"),
      fileName: "notes.txt",
      mimeType: "text/plain",
    });
    expect(unsupported.ok).toBe(false);
    if (!unsupported.ok) {
      expect(unsupported.error.code).toBe("UNSUPPORTED_TYPE");
    }

    const empty = await extractResumeText({
      content: Buffer.alloc(0),
      fileName: "cv.pdf",
      mimeType: "application/pdf",
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error.code).toBe("EMPTY_DOCUMENT");
    }
  });
});
