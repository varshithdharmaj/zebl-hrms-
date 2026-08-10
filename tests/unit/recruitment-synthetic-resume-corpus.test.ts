import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractResumeText } from "@/lib/recruitment/resume-import/parser/extract-text";
import { parseResumeDocument } from "@/lib/recruitment/resume-import/parser";
import { matchSectionHeader } from "@/lib/recruitment/resume-import/parser/sections";
import { cleanupResumeText, splitResumeLines } from "@/lib/recruitment/resume-import/parser/cleanup";

const CORPUS_DIR = join(process.cwd(), "..", "synthetic-resumes");

const PDF_FILES = [
  "resume-01-senior-fullstack.pdf",
  "resume-02-node-backend.pdf",
  "resume-03-ml-engineer.pdf",
  "resume-04-frontend-parser-stress.pdf",
  "resume-05-junior-sparse.pdf",
] as const;

const DOCX_FILES = [
  "resume-01-senior-fullstack.docx",
  "resume-02-node-backend.docx",
  "resume-03-ml-engineer.docx",
  "resume-04-frontend-parser-stress.docx",
  "resume-05-junior-sparse.docx",
] as const;

function mimeFor(fileName: string): string {
  return fileName.endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function detectedSections(text: string): string[] {
  const headers = splitResumeLines(cleanupResumeText(text))
    .map((line) => matchSectionHeader(line))
    .filter((h): h is NonNullable<typeof h> => Boolean(h) && h !== "ignore");
  return [...new Set(headers)];
}

const corpusAvailable =
  existsSync(CORPUS_DIR) &&
  PDF_FILES.every((f) => existsSync(join(CORPUS_DIR, f)));

describe.skipIf(!corpusAvailable)("synthetic resume corpus — PDF extraction structure", () => {
  it("preserves meaningful newlines and section headings for all synthetic PDFs", async () => {
    for (const file of PDF_FILES) {
      const content = readFileSync(join(CORPUS_DIR, file));
      const extracted = await extractResumeText({
        content,
        fileName: file,
        mimeType: mimeFor(file),
      });
      expect(extracted.ok, file).toBe(true);
      if (!extracted.ok) continue;

      const text = extracted.extraction.text;
      const newlines = (text.match(/\n/g) ?? []).length;
      expect(newlines, `${file} newlines`).toBeGreaterThan(10);

      // Must not be a single flattened blob (regression for mergePages:true collapse).
      const firstBreak = text.indexOf("\n");
      expect(firstBreak, `${file} early newline`).toBeGreaterThan(0);
      expect(firstBreak, `${file} early newline`).toBeLessThan(200);

      const sections = detectedSections(text);
      expect(sections, `${file} sections`).toEqual(
        expect.arrayContaining(["experience", "education", "skills"])
      );
    }
  });

  it("parses structured drafts from synthetic PDFs (not essentially empty)", async () => {
    for (const file of PDF_FILES) {
      const content = readFileSync(join(CORPUS_DIR, file));
      const { result, draftContent } = await parseResumeDocument({
        content,
        fileName: file,
        mimeType: mimeFor(file),
        documentId: "corpus-audit",
        semanticVerification: false,
      });

      expect(result.ok, file).toBe(true);
      expect(draftContent.metadata.parserVersion).toBe("deterministic-v2");

      const mapped = draftContent.mapped;
      expect(mapped.personal.fullName, `${file} name`).toBeTruthy();
      expect(mapped.personal.email, `${file} email`).toBeTruthy();
      expect(mapped.experiences.length, `${file} experiences`).toBeGreaterThan(0);
      expect(mapped.educations.length, `${file} educations`).toBeGreaterThan(0);
      expect(mapped.skills.length, `${file} skills`).toBeGreaterThan(0);

      const extracted = await extractResumeText({
        content,
        fileName: file,
        mimeType: mimeFor(file),
      });
      const sections = extracted.ok
        ? detectedSections(extracted.extraction.text)
        : [];
      if (sections.includes("projects")) {
        expect(mapped.projects.length, `${file} projects`).toBeGreaterThan(0);
      }
      if (sections.includes("certifications")) {
        expect(
          mapped.certifications.length,
          `${file} certifications`
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe.skipIf(!corpusAvailable)("synthetic resume corpus — DOCX regression", () => {
  it("keeps DOCX structured drafts non-empty for all fixtures", async () => {
    expect(readdirSync(CORPUS_DIR).some((f) => f.endsWith(".docx"))).toBe(true);

    for (const file of DOCX_FILES) {
      const content = readFileSync(join(CORPUS_DIR, file));
      const { result, draftContent } = await parseResumeDocument({
        content,
        fileName: file,
        mimeType: mimeFor(file),
        documentId: "corpus-docx",
        semanticVerification: false,
      });
      expect(result.ok, file).toBe(true);
      const mapped = draftContent.mapped;
      expect(mapped.personal.fullName, file).toBeTruthy();
      expect(mapped.experiences.length, file).toBeGreaterThan(0);
      expect(mapped.skills.length, file).toBeGreaterThan(0);
    }
  });
});
