import "server-only";

import { prismaCandidateRepository } from "@/lib/recruitment/repositories/prisma-candidate-repository";
import {
  normalizeEmail,
  normalizePhone,
} from "@/lib/recruitment/candidate/candidate-normalizer";

export type CandidateResolution =
  | { kind: "reuse"; candidateId: string }
  | {
      kind: "create";
      duplicateOfCandidateId: string | null;
      duplicateConfidence: number | null;
    };

/**
 * Dedup signal priority (Phase-3 design §10):
 *  - normalized email exact match → reuse the existing Candidate (email is not
 *    reassigned/shared the way phone numbers commonly are).
 *  - phone-only match → NEVER auto-merge; create a new Candidate and flag it
 *    (duplicateOfCandidateId/duplicateConfidence) for HR review. Silently
 *    merging two different people who once shared a phone number is a worse
 *    failure mode than an occasional near-duplicate HR can merge manually
 *    (Candidate.mergedIntoCandidateId already exists for that).
 *  - no match → create, no duplicate flag.
 *
 * Never distinguishes "no match" from "phone-only match" in a way that's
 * observable by the anonymous caller — both result in a new Candidate being
 * created; the difference is HR-internal metadata only.
 */
export async function resolveCandidateForPublicApplication(input: {
  email: string | null;
  phone: string | null;
}): Promise<CandidateResolution> {
  const normalizedEmail = normalizeEmail(input.email);
  if (normalizedEmail) {
    const existing = await prismaCandidateRepository.findByNormalizedEmail(normalizedEmail);
    if (existing && !existing.deletedAt) {
      return { kind: "reuse", candidateId: existing.id };
    }
  }

  const normalizedPhone = normalizePhone(input.phone);
  if (normalizedPhone) {
    const existing = await prismaCandidateRepository.findByNormalizedPhone(normalizedPhone);
    if (existing && !existing.deletedAt) {
      return {
        kind: "create",
        duplicateOfCandidateId: existing.id,
        duplicateConfidence: 0.5,
      };
    }
  }

  return { kind: "create", duplicateOfCandidateId: null, duplicateConfidence: null };
}
