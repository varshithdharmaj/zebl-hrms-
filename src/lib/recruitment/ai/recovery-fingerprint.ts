import "server-only";

import { createHash } from "node:crypto";
import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import { listEligibleRecoveryFields } from "./recovery-eligible";
import { RESUME_FIELD_RECOVERY_PROMPT_VERSION } from "./recovery-types";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function computeRecoveryInputFingerprint(input: {
  candidate: CandidateDetail;
  documentId: string | null;
  sourceDraftId: string | null;
  resumeTextHash: string;
}): string {
  const eligible = listEligibleRecoveryFields(input.candidate);
  const payload = {
    promptVersion: RESUME_FIELD_RECOVERY_PROMPT_VERSION,
    documentId: input.documentId,
    sourceDraftId: input.sourceDraftId,
    resumeTextHash: input.resumeTextHash,
    eligibleFields: [...eligible].sort(),
    // Snapshot of currently filled safe fields (not email/phone/CTC).
    filled: {
      location: Boolean(input.candidate.location?.trim()),
      headline: Boolean(input.candidate.headline?.trim()),
      professionalSummary: Boolean(input.candidate.professionalSummary?.trim()),
      githubUrl: Boolean(input.candidate.githubUrl?.trim()),
      linkedinUrl: Boolean(
        (input.candidate.linkedinUrl ?? input.candidate.personal?.linkedinUrl)?.trim()
      ),
      portfolioUrl: Boolean(input.candidate.personal?.portfolioUrl?.trim()),
      experienceCount: (input.candidate.experiences ?? []).length,
      educationCount: (input.candidate.educations ?? []).length,
      skillCount: (input.candidate.skills ?? []).length,
      projectCount: (input.candidate.projects ?? []).length,
      certificationCount: (input.candidate.certifications ?? []).length,
    },
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function hashResumeText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function recoveryFingerprintsMatch(
  stored: string | null | undefined,
  current: string
): boolean {
  if (!stored || !stored.trim()) return false;
  return stored === current;
}
