/**
 * Client-side resume file validation for the Add Candidate upload UI.
 * No parsing, OCR, or server upload — selection gates only.
 */

export const RESUME_UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const RESUME_UPLOAD_ACCEPT =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx"]);

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type ResumeFileValidationResult =
  | { ok: true; file: File }
  | { ok: false; error: string };

function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

export function formatResumeFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateResumeFile(file: File | null | undefined): ResumeFileValidationResult {
  if (!file) {
    return { ok: false, error: "Please select a resume file." };
  }

  const extension = getExtension(file.name);
  const mimeOk = !file.type || ALLOWED_MIME_TYPES.has(file.type);
  const extensionOk = ALLOWED_EXTENSIONS.has(extension);

  if (!extensionOk || !mimeOk) {
    return {
      ok: false,
      error: "Only PDF or DOCX resumes are supported.",
    };
  }

  if (file.size <= 0) {
    return { ok: false, error: "The selected file is empty." };
  }

  if (file.size > RESUME_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      error: `File is too large. Maximum size is ${formatResumeFileSize(RESUME_UPLOAD_MAX_BYTES)}.`,
    };
  }

  return { ok: true, file };
}
