import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import type { RecoveryFieldKey } from "./recovery-types";

function isFilledText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Application-owned eligible empty fields for recovery.
 * Collections are eligible only when the candidate has zero rows.
 */
export function listEligibleRecoveryFields(
  candidate: CandidateDetail
): RecoveryFieldKey[] {
  const eligible: RecoveryFieldKey[] = [];

  if (!isFilledText(candidate.location)) eligible.push("location");
  if (!isFilledText(candidate.headline)) eligible.push("headline");
  if (!isFilledText(candidate.professionalSummary)) {
    eligible.push("professionalSummary");
  }
  if (!isFilledText(candidate.githubUrl)) eligible.push("githubUrl");
  if (!isFilledText(candidate.linkedinUrl ?? candidate.personal?.linkedinUrl)) {
    eligible.push("linkedinUrl");
  }
  if (!isFilledText(candidate.personal?.portfolioUrl)) {
    eligible.push("portfolioUrl");
  }
  if ((candidate.experiences ?? []).length === 0) eligible.push("experience");
  if ((candidate.educations ?? []).length === 0) eligible.push("education");
  if ((candidate.skills ?? []).length === 0) eligible.push("skill");
  if ((candidate.projects ?? []).length === 0) eligible.push("project");
  if ((candidate.certifications ?? []).length === 0) {
    eligible.push("certification");
  }

  return eligible;
}

/** True when the target recovery field is still empty on the live candidate. */
export function isRecoveryFieldStillEmpty(
  candidate: CandidateDetail,
  field: RecoveryFieldKey
): boolean {
  return listEligibleRecoveryFields(candidate).includes(field);
}
