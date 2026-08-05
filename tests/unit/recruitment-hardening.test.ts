import { describe, expect, it } from "vitest";
import {
  validateCommunicationAttachment,
} from "@/lib/recruitment/communication/attachment-rules";
import {
  buildCandidateDocumentStorageKey,
  buildCommunicationAttachmentStoragePath,
  isSafeCandidateDocumentKey,
  sanitizeDownloadFileName,
} from "@/lib/recruitment/shared/storage-paths";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { PermissionError } from "@/lib/permissions";

describe("recruitment hardening — attachment validation", () => {
  it("rejects mismatched mime + dangerous extension (OR bypass)", () => {
    const result = validateCommunicationAttachment({
      fileName: "payload.exe",
      fileType: "image/png",
      fileSize: 1024,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("unsupported_type");
  });

  it("rejects allowed extension with disallowed non-generic mime", () => {
    const result = validateCommunicationAttachment({
      fileName: "resume.pdf",
      fileType: "application/x-msdownload",
      fileSize: 1024,
    });
    expect(result.ok).toBe(false);
  });

  it("still allows octet-stream with allowed extension", () => {
    const result = validateCommunicationAttachment({
      fileName: "notes.txt",
      fileType: "application/octet-stream",
      fileSize: 40,
    });
    expect(result.ok).toBe(true);
  });
});

describe("recruitment hardening — storage paths", () => {
  it("builds candidate keys under the candidate prefix", () => {
    const key = buildCandidateDocumentStorageKey("cand-1", "My Resume.pdf");
    expect(key.startsWith("candidates/cand-1/documents/")).toBe(true);
    expect(key.includes("..")).toBe(false);
    expect(isSafeCandidateDocumentKey("cand-1", key)).toBe(true);
  });

  it("rejects traversal-style keys", () => {
    expect(
      isSafeCandidateDocumentKey("cand-1", "candidates/cand-1/documents/../secrets")
    ).toBe(false);
  });

  it("builds communication attachment paths under communication id", () => {
    const path = buildCommunicationAttachmentStoragePath("comm-9", "offer.docx");
    expect(path.startsWith("communications/comm-9/attachments/")).toBe(true);
  });

  it("strips CR/LF from download filenames", () => {
    expect(sanitizeDownloadFileName('evil\r\nname".pdf')).toBe("evilname.pdf");
  });
});

describe("recruitment hardening — error mapping", () => {
  it("maps domain and permission errors to messages", () => {
    expect(
      mapUnknownToActionState(
        new RecruitmentDomainError("REC_VALIDATION", "Bad input")
      )
    ).toEqual({ error: "Bad input" });
    expect(mapUnknownToActionState(new PermissionError("Denied"))).toEqual({
      error: "Denied",
    });
  });

  it("does not leak unexpected Error messages", () => {
    expect(
      mapUnknownToActionState(new Error("prisma: relation deletedAt does not exist"))
    ).toEqual({ error: "Unexpected error." });
  });
});
