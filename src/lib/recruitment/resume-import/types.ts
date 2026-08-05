import type { PreferredWorkMode } from "@/generated/prisma/enums";

/** Scalar fields allowed for resume import (never CTC/notice/join/status). */
export type ResumeImportPersonalMapped = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
};

export type ResumeImportProfessionalMapped = {
  headline?: string | null;
  professionalSummary?: string | null;
  currentCompany?: string | null;
  currentTitle?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  totalExperienceYears?: string | null;
  preferredWorkMode?: PreferredWorkMode | null;
  willingToRelocate?: boolean | null;
};

export type ResumeImportExperienceMapped = {
  company: string;
  title: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  description?: string | null;
  sortOrder?: number;
};

export type ResumeImportEducationMapped = {
  institution: string;
  degree?: string | null;
  field?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  grade?: string | null;
  sortOrder?: number;
};

export type ResumeImportSkillMapped = {
  name: string;
  proficiency?: string | null;
  yearsOfExperience?: number | null;
};

export type ResumeImportProjectMapped = {
  title: string;
  summary?: string | null;
  techStack?: string | null;
  url?: string | null;
  role?: string | null;
  duration?: string | null;
  sortOrder?: number;
};

export type ResumeImportCertificationMapped = {
  name: string;
  issuer?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  credentialId?: string | null;
  credentialUrl?: string | null;
};

export type ResumeImportMappedDraft = {
  personal: ResumeImportPersonalMapped;
  professional: ResumeImportProfessionalMapped;
  experiences: ResumeImportExperienceMapped[];
  educations: ResumeImportEducationMapped[];
  skills: ResumeImportSkillMapped[];
  projects: ResumeImportProjectMapped[];
  certifications: ResumeImportCertificationMapped[];
};

/**
 * Stored in CandidateAiInsight.contentJson.
 * Future parsers fill `raw` + `mapped` and call CreateResumeImportDraft.
 */
export type ResumeImportDraftContent = {
  version: 1;
  source: "stub" | "parser" | "ai";
  documentId: string | null;
  raw: Record<string, unknown>;
  mapped: ResumeImportMappedDraft;
  fieldConfidence: Record<string, number>;
  metadata: {
    parserVersion?: string;
    note?: string;
  };
};

export type FieldDiffStatus = "new" | "changed" | "conflict" | "missing" | "unchanged";

export type ScalarFieldDiff = {
  key: string;
  label: string;
  group: "personal" | "professional";
  current: string | null;
  imported: string | null;
  status: FieldDiffStatus;
  confidence?: number;
};

export type SectionDiffStatus = "new" | "changed" | "unchanged" | "missing";

export type SectionDiff = {
  section: "experiences" | "educations" | "skills" | "projects" | "certifications";
  label: string;
  currentCount: number;
  importedCount: number;
  status: SectionDiffStatus;
  currentPreview: string;
  importedPreview: string;
};

export type FieldAction = "accept" | "ignore";

export type ScalarFieldDecision = {
  key: string;
  action: FieldAction;
  /** When accept + edited, this value is applied. */
  editedValue?: string | number | boolean | null;
};

export type SectionDecision = {
  section: SectionDiff["section"];
  action: FieldAction;
  /** When accept + edited, replace section with these rows. */
  editedRows?: Record<string, unknown>[];
};

export type ResumeImportApplyInput = {
  draftId: string;
  candidateId: string;
  scalarDecisions: ScalarFieldDecision[];
  sectionDecisions: SectionDecision[];
};

/** Fields that must never be written by resume import. */
export const RESUME_IMPORT_DENIED_SCALAR_KEYS = [
  "currentCtc",
  "expectedCtc",
  "currency",
  "noticePeriodDays",
  "earliestJoinDate",
  "availabilityNotes",
  "status",
  "source",
  "doNotHireReason",
  "preferredLocation",
  "noticePeriod",
  "assessment",
] as const;
