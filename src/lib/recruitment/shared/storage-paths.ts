/** Sanitize uploaded file names for storage keys (no path segments). */
export function sanitizeStorageFileName(fileName: string): string {
  const base = fileName.trim().replace(/^.*[/\\]/, "");
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
  return cleaned || "file";
}

export function buildCandidateDocumentStorageKey(
  candidateId: string,
  fileName: string
): string {
  return `candidates/${candidateId}/documents/${crypto.randomUUID()}-${sanitizeStorageFileName(fileName)}`;
}

export function buildOfferPdfStorageKey(offerId: string, fileName: string): string {
  return `offers/${offerId}/pdf/${crypto.randomUUID()}-${sanitizeStorageFileName(fileName)}`;
}

export function buildEmployeeDocumentStorageKey(
  employeeId: number,
  fileName: string
): string {
  return `employees/${employeeId}/documents/${crypto.randomUUID()}-${sanitizeStorageFileName(fileName)}`;
}

export function isSafeOfferPdfKey(offerId: string, key: string): boolean {
  const prefix = `offers/${offerId}/pdf/`;
  return (
    key.startsWith(prefix) &&
    !key.includes("..") &&
    !key.includes("\\") &&
    !key.includes("//", prefix.length)
  );
}

export function isSafeEmployeeDocumentKey(employeeId: number, key: string): boolean {
  const prefix = `employees/${employeeId}/documents/`;
  return (
    key.startsWith(prefix) &&
    !key.includes("..") &&
    !key.includes("\\") &&
    !key.includes("//", prefix.length)
  );
}

export function buildCommunicationAttachmentStoragePath(
  communicationId: string,
  fileName: string
): string {
  return `communications/${communicationId}/attachments/${crypto.randomUUID()}-${sanitizeStorageFileName(fileName)}`;
}

export function isSafeCandidateDocumentKey(
  candidateId: string,
  key: string
): boolean {
  const prefix = `candidates/${candidateId}/documents/`;
  return (
    key.startsWith(prefix) &&
    !key.includes("..") &&
    !key.includes("\\") &&
    !key.includes("//", prefix.length)
  );
}

export function sanitizeDownloadFileName(name: string): string {
  return name.replace(/[\r\n"]/g, "").slice(0, 180) || "download";
}
