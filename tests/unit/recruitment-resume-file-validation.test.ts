import { describe, expect, it } from "vitest";
import {
  RESUME_UPLOAD_MAX_BYTES,
  validateResumeFile,
} from "@/lib/recruitment/resume-import/file-validation";

function makeFile(
  name: string,
  size: number,
  type: string
): File {
  const blob = new Blob([new Uint8Array(Math.min(size, 64))], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateResumeFile", () => {
  it("accepts pdf and docx within size limit", () => {
    expect(
      validateResumeFile(
        makeFile("cv.pdf", 1024, "application/pdf")
      ).ok
    ).toBe(true);
    expect(
      validateResumeFile(
        makeFile(
          "cv.docx",
          2048,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).ok
    ).toBe(true);
  });

  it("rejects unsupported types and oversized files", () => {
    const badType = validateResumeFile(makeFile("notes.txt", 100, "text/plain"));
    expect(badType.ok).toBe(false);
    if (!badType.ok) {
      expect(badType.error).toMatch(/PDF or DOCX/i);
    }

    const tooBig = validateResumeFile(
      makeFile("huge.pdf", RESUME_UPLOAD_MAX_BYTES + 1, "application/pdf")
    );
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) {
      expect(tooBig.error).toMatch(/too large/i);
    }
  });

  it("rejects empty selection", () => {
    const result = validateResumeFile(null);
    expect(result.ok).toBe(false);
  });
});
