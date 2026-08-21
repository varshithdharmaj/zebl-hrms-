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

/** Temporary resume storage before a Candidate exists (new-candidate-from-resume). */
export function buildIntakeResumeStorageKey(
  intakeId: string,
  fileName: string
): string {
  return `recruitment/intake/${intakeId}/documents/${crypto.randomUUID()}-${sanitizeStorageFileName(fileName)}`;
}

export function isSafeIntakeResumeKey(intakeId: string, key: string): boolean {
  const prefix = `recruitment/intake/${intakeId}/documents/`;
  return (
    key.startsWith(prefix) &&
    !key.includes("..") &&
    !key.includes("\\") &&
    !key.includes("//", prefix.length)
  );
}

/**
 * Temporary resume storage for anonymous public /apply submissions, before a
 * Candidate exists. Deliberately a separate namespace from `recruitment/intake/*`
 * (HR-initiated) and `candidates/*` (permanent) — see PublicApplicationSubmission
 * schema comment. Month-partitioned so an operator can archive/delete a whole
 * `public-intake/YYYY-MM/` directory once everything in it is terminal
 * (copied to a permanent CandidateDocument, or expired).
 */
export function monthPartitionFor(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function buildPublicIntakeStorageKey(
  submissionId: string,
  fileName: string,
  monthPartition: string
): string {
  return `public-intake/${monthPartition}/${submissionId}/${sanitizeStorageFileName(fileName)}`;
}

export function isSafePublicIntakeKey(
  submissionId: string,
  monthPartition: string,
  key: string
): boolean {
  const prefix = `public-intake/${monthPartition}/${submissionId}/`;
  return (
    key.startsWith(prefix) &&
    !key.includes("..") &&
    !key.includes("\\") &&
    !key.includes("//", prefix.length)
  );
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
