/** Sanitize uploaded file names for storage keys (no path segments). */
export function sanitizeStorageFileName(fileName: string): string {
  const base = fileName.trim().replace(/^.*[/\\]/, "");
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
  return cleaned || "file";
}

/**
 * Generic `<prefix><uuid>-<sanitized-filename>` key builder shared by every
 * UUID-keyed storage namespace. `prefix` must include its trailing slash,
 * e.g. `candidates/${candidateId}/documents/`.
 */
export function buildStorageKey(prefix: string, fileName: string): string {
  return `${prefix}${crypto.randomUUID()}-${sanitizeStorageFileName(fileName)}`;
}

/**
 * Generic traversal-safe prefix check shared by every UUID-keyed storage
 * namespace: the key must live under `prefix` and contain no `..`, `\`, or
 * `//` beyond the prefix itself.
 */
export function isSafeStorageKey(prefix: string, key: string): boolean {
  return (
    key.startsWith(prefix) &&
    !key.includes("..") &&
    !key.includes("\\") &&
    !key.includes("//", prefix.length)
  );
}

export function buildCandidateDocumentStorageKey(
  candidateId: string,
  fileName: string
): string {
  return buildStorageKey(`candidates/${candidateId}/documents/`, fileName);
}

export function isSafeCandidateDocumentKey(
  candidateId: string,
  key: string
): boolean {
  return isSafeStorageKey(`candidates/${candidateId}/documents/`, key);
}

/** Temporary resume storage before a Candidate exists (new-candidate-from-resume). */
export function buildIntakeResumeStorageKey(
  intakeId: string,
  fileName: string
): string {
  return buildStorageKey(`recruitment/intake/${intakeId}/documents/`, fileName);
}

export function isSafeIntakeResumeKey(intakeId: string, key: string): boolean {
  return isSafeStorageKey(`recruitment/intake/${intakeId}/documents/`, key);
}

/**
 * Temporary resume storage for anonymous public /apply submissions, before a
 * Candidate exists. Deliberately a separate namespace from `recruitment/intake/*`
 * (HR-initiated) and `candidates/*` (permanent) — see PublicApplicationSubmission
 * schema comment. Month-partitioned so an operator can archive/delete a whole
 * `public-intake/YYYY-MM/` directory once everything in it is terminal
 * (copied to a permanent CandidateDocument, or expired).
 *
 * Deliberately NOT built on buildStorageKey()/isSafeStorageKey(): there is no
 * UUID (the resume/photo upload handlers overwrite-in-place by submission id,
 * so filename-only collision is intentional, not a bug), and the safety check
 * needs an extra `monthPartition` segment the generic 2-arg shape doesn't have.
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
  return buildStorageKey(`offers/${offerId}/pdf/`, fileName);
}

export function isSafeOfferPdfKey(offerId: string, key: string): boolean {
  return isSafeStorageKey(`offers/${offerId}/pdf/`, key);
}

export function buildEmployeeDocumentStorageKey(
  employeeId: number,
  fileName: string
): string {
  return buildStorageKey(`employees/${employeeId}/documents/`, fileName);
}

export function isSafeEmployeeDocumentKey(employeeId: number, key: string): boolean {
  return isSafeStorageKey(`employees/${employeeId}/documents/`, key);
}

export function buildCommunicationAttachmentStoragePath(
  communicationId: string,
  fileName: string
): string {
  return buildStorageKey(`communications/${communicationId}/attachments/`, fileName);
}

export function sanitizeDownloadFileName(name: string): string {
  return name.replace(/[\r\n"]/g, "").slice(0, 180) || "download";
}
