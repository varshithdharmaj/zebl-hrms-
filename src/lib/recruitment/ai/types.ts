/** Candidate AI enrichment MVP types (server-only domain). */

export type FieldFillStatus = "filled" | "empty";

export type CandidateFieldStatusMap = {
  summary: FieldFillStatus;
  headline: FieldFillStatus;
  githubUrl: FieldFillStatus;
  portfolioUrl: FieldFillStatus;
  linkedinUrl: FieldFillStatus;
  currentCompany: FieldFillStatus;
  currentTitle: FieldFillStatus;
  experienceYears: FieldFillStatus;
  experience: FieldFillStatus;
  education: FieldFillStatus;
  skills: FieldFillStatus;
  projects: FieldFillStatus;
  certifications: FieldFillStatus;
  noticePeriod: FieldFillStatus;
  expectedCtc: FieldFillStatus;
  currentCtc: FieldFillStatus;
  earliestJoinDate: FieldFillStatus;
  availability: FieldFillStatus;
};

export type CandidateEnrichmentOutput = {
  summary: string;
  headline: string;
  strengths: string[];
  missingInformation: string[];
  interviewTopics: string[];
};

export type CandidateEnrichmentContext = {
  candidate: {
    currentTitle: string | null;
    currentCompany: string | null;
    location: string | null;
    experienceYears: string | null;
    summary: string | null;
    headline: string | null;
  };
  skills: string[];
  experience: Array<{
    title: string;
    company: string;
    isCurrent?: boolean;
    description?: string | null;
  }>;
  education: Array<{
    institution: string;
    degree?: string | null;
    endYear?: number | null;
  }>;
  projects: Array<{
    title: string;
    summary?: string | null;
    techStack?: string | null;
  }>;
  certifications: Array<{
    name: string;
    issuer?: string | null;
  }>;
  /** Application-owned filled/empty map — LLM must not recompute this. */
  fieldStatus: CandidateFieldStatusMap;
  /** Application-owned empty-field labels — source of truth for missingInformation. */
  missingFields: string[];
  /** Bounded excerpt only when summary evidence is thin. */
  resumeExcerpt?: string | null;
};

export type CandidateEnrichmentInsightContent = {
  version: 1;
  kind: "candidate_enrichment";
  promptVersion: string;
  documentId: string | null;
  sourceDraftId: string | null;
  /** SHA-256 of enrichment-relevant candidate/draft inputs at generation time. */
  inputFingerprint?: string | null;
  fieldStatus: CandidateFieldStatusMap;
  enrichment: CandidateEnrichmentOutput;
  applied: {
    summary: boolean;
    headline: boolean;
  };
};

export const CANDIDATE_ENRICHMENT_PROMPT_VERSION = "candidate-enrichment-v1";
export const CANDIDATE_ENRICHMENT_CONTENT_KIND = "candidate_enrichment" as const;
