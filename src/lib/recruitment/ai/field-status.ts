import type { CandidateDetail } from "@/lib/recruitment/candidate/types";
import type { CandidateFieldStatusMap, FieldFillStatus } from "./types";

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function status(value: unknown): FieldFillStatus {
  return isFilled(value) ? "filled" : "empty";
}

/**
 * Application-owned field status. The LLM must not decide emptiness.
 */
export function computeCandidateFieldStatus(
  candidate: CandidateDetail
): CandidateFieldStatusMap {
  return {
    summary: status(candidate.professionalSummary),
    headline: status(candidate.headline),
    githubUrl: status(candidate.githubUrl),
    portfolioUrl: status(candidate.personal?.portfolioUrl),
    linkedinUrl: status(candidate.linkedinUrl ?? candidate.personal?.linkedinUrl),
    currentCompany: status(candidate.currentCompany),
    currentTitle: status(candidate.currentTitle),
    experienceYears: status(candidate.totalExperienceYears),
    experience: status(candidate.experiences),
    education: status(candidate.educations),
    skills: status(candidate.skills),
    projects: status(candidate.projects),
    certifications: status(candidate.certifications),
    noticePeriod: status(
      candidate.noticePeriodDays ?? candidate.personal?.noticePeriod
    ),
    expectedCtc: status(candidate.expectedCtc),
    currentCtc: status(candidate.currentCtc),
    earliestJoinDate: status(candidate.earliestJoinDate),
    availability: status(
      candidate.availabilityNotes ?? candidate.personal?.availabilityDate
    ),
  };
}

/** Labels safe to surface as "missing information" (never invent values). */
export const MISSING_INFO_FIELD_LABELS: Record<
  keyof CandidateFieldStatusMap,
  string
> = {
  summary: "Professional summary",
  headline: "Headline",
  githubUrl: "GitHub URL",
  portfolioUrl: "Portfolio URL",
  linkedinUrl: "LinkedIn URL",
  currentCompany: "Current company",
  currentTitle: "Current title",
  experienceYears: "Total experience years",
  experience: "Employment history",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  noticePeriod: "Notice period",
  expectedCtc: "Expected CTC",
  currentCtc: "Current CTC",
  earliestJoinDate: "Earliest joining date",
  availability: "Availability",
};

/** Fields AI may help fill via explicit recruiter accept (insights only). */
export const AI_APPLYABLE_FIELDS = ["summary", "headline"] as const;

/** Sensitive — AI must not invent values; may list as missing only. */
export const SENSITIVE_MISSING_FIELDS = [
  "noticePeriod",
  "expectedCtc",
  "currentCtc",
  "earliestJoinDate",
  "availability",
] as const;

export function listMissingFieldLabels(
  fieldStatus: CandidateFieldStatusMap
): string[] {
  return (Object.keys(fieldStatus) as Array<keyof CandidateFieldStatusMap>)
    .filter((key) => fieldStatus[key] === "empty")
    .map((key) => MISSING_INFO_FIELD_LABELS[key]);
}
