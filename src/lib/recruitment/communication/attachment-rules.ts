export const COMMUNICATION_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const COMMUNICATION_ATTACHMENT_ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "png",
  "jpg",
  "jpeg",
  "txt",
] as const;

export const COMMUNICATION_ATTACHMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "text/plain",
] as const;

export type AttachmentValidationError =
  | "empty_file"
  | "file_too_large"
  | "unsupported_type";

export type AttachmentValidationResult =
  | { ok: true }
  | { ok: false; error: AttachmentValidationError; message: string };

export type VirusScanInput = {
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
};

export type VirusScanResult =
  | { ok: true; provider: "noop" }
  | { ok: false; provider: "noop"; reason: string };

function extensionOf(fileName: string): string {
  const parts = fileName.trim().toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

export function isAllowedAttachmentExtension(fileName: string): boolean {
  const ext = extensionOf(fileName);
  return (COMMUNICATION_ATTACHMENT_ALLOWED_EXTENSIONS as readonly string[]).includes(
    ext
  );
}

export function isAllowedAttachmentMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized || normalized === "application/octet-stream") {
    return false;
  }
  return (COMMUNICATION_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(
    normalized
  );
}

export function validateCommunicationAttachment(input: {
  fileName: string;
  fileType: string;
  fileSize: number;
}): AttachmentValidationResult {
  if (!input.fileName.trim()) {
    return {
      ok: false,
      error: "empty_file",
      message: "File name is required.",
    };
  }

  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    return {
      ok: false,
      error: "empty_file",
      message: "File is empty.",
    };
  }

  if (input.fileSize > COMMUNICATION_ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      error: "file_too_large",
      message: `Attachment exceeds the ${COMMUNICATION_ATTACHMENT_MAX_BYTES / (1024 * 1024)} MB limit.`,
    };
  }

  const mime = input.fileType.trim().toLowerCase();
  const mimeIsGeneric = !mime || mime === "application/octet-stream";
  const mimeOk = isAllowedAttachmentMimeType(input.fileType);
  const extOk = isAllowedAttachmentExtension(input.fileName);

  // Require a known extension; MIME must match allowlist unless generic octet-stream.
  if (!extOk || (!mimeOk && !mimeIsGeneric)) {
    return {
      ok: false,
      error: "unsupported_type",
      message:
        "Unsupported file type. Allowed: PDF, DOC, DOCX, PNG, JPG, JPEG, TXT.",
    };
  }

  return { ok: true };
}

/**
 * Virus scan hook placeholder.
 * Replace with ClamAV / cloud AV provider integration without changing call sites.
 */
export async function scanAttachmentForVirus(
  _input: VirusScanInput
): Promise<VirusScanResult> {
  return { ok: true, provider: "noop" };
}

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPreviewableAttachment(input: {
  fileName: string;
  fileType: string;
}): boolean {
  const mime = input.fileType.toLowerCase();
  const name = input.fileName.toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return true;
  if (mime.startsWith("image/") || /\.(png|jpe?g)$/.test(name)) return true;
  if (mime === "text/plain" || name.endsWith(".txt")) return true;
  return false;
}
