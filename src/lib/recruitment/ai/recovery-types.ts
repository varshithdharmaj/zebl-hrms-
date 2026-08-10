/** Resume field recovery AI — separate from candidate_summary enrichment. */

export const RESUME_FIELD_RECOVERY_CONTENT_KIND = "resume_field_recovery" as const;
export const RESUME_FIELD_RECOVERY_PROMPT_VERSION = "resume-field-recovery-v1";

export const RECOVERY_SCALAR_FIELDS = [
  "location",
  "headline",
  "professionalSummary",
  "githubUrl",
  "linkedinUrl",
  "portfolioUrl",
] as const;

export const RECOVERY_COLLECTION_FIELDS = [
  "experience",
  "education",
  "skill",
  "project",
  "certification",
] as const;

export const RECOVERY_FIELDS = [
  ...RECOVERY_SCALAR_FIELDS,
  ...RECOVERY_COLLECTION_FIELDS,
] as const;

export type RecoveryFieldKey = (typeof RECOVERY_FIELDS)[number];
export type RecoveryConfidence = "high" | "medium";

export type RecoveryExperienceValue = {
  company: string;
  title: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string | null;
};

export type RecoveryEducationValue = {
  institution: string;
  degree?: string | null;
  field?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  grade?: string | null;
};

export type RecoveryProjectValue = {
  title: string;
  summary?: string | null;
  techStack?: string | null;
  url?: string | null;
  duration?: string | null;
};

export type RecoveryCertificationValue = {
  name: string;
  issuer?: string | null;
  issuedAt?: string | null;
  credentialId?: string | null;
  credentialUrl?: string | null;
};

export type RecoveryProposal = {
  id: string;
  field: RecoveryFieldKey;
  value: unknown;
  confidence: RecoveryConfidence;
  evidence: string;
  applied: boolean;
};

export type ResumeFieldRecoveryInsightContent = {
  version: 1;
  kind: typeof RESUME_FIELD_RECOVERY_CONTENT_KIND;
  promptVersion: string;
  documentId: string | null;
  sourceDraftId: string | null;
  inputFingerprint: string;
  /** Hash of resume text used at generation — used for UI freshness without re-reading storage. */
  resumeTextHash: string;
  eligibleFields: RecoveryFieldKey[];
  proposals: RecoveryProposal[];
};

export type ResumeFieldRecoveryContext = {
  eligibleFields: RecoveryFieldKey[];
  /** Bounded sanitized resume text for evidence-backed recovery. */
  resumeText: string;
  parsedCandidate: {
    headline: string | null;
    summary: string | null;
    location: string | null;
    githubUrl: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
    experiences: Array<{
      title: string;
      company: string;
      location?: string | null;
    }>;
    education: Array<{
      institution: string;
      degree?: string | null;
      field?: string | null;
      endYear?: number | null;
    }>;
    skills: string[];
    projects: Array<{
      title: string;
      summary?: string | null;
      techStack?: string | null;
    }>;
    certifications: Array<{
      name: string;
      issuer?: string | null;
    }>;
  };
};
