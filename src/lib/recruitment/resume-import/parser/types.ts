/**
 * Resume parser pipeline types.
 * Pure data only — no DB / network.
 */

export type ResumeParserErrorCode =
  | "UNSUPPORTED_TYPE"
  | "EMPTY_DOCUMENT"
  | "EXTRACTION_FAILED"
  | "PARSE_FAILED"
  | "CORRUPTED_FILE";

export type ResumeParserError = {
  code: ResumeParserErrorCode;
  message: string;
  details?: string;
};

export type ResumeTextExtraction = {
  text: string;
  mimeType: string;
  fileName: string;
  pageCount?: number;
};

export type ParsedResumePersonal = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
};

export type ParsedResumeExperience = {
  company: string;
  title: string;
  location?: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
};

export type ParsedResumeEducation = {
  institution: string;
  degree: string | null;
  field: string | null;
  graduationYear: number | null;
};

export type ParsedResumeProject = {
  title: string;
  summary: string | null;
  techStack: string | null;
  url: string | null;
  duration: string | null;
};

export type ParsedResumeCertification = {
  name: string;
  issuer: string | null;
  issuedAt: string | null;
  credentialUrl: string | null;
  credentialId: string | null;
};

export type ParsedResumeDraft = {
  personal: ParsedResumePersonal;
  professional: {
    /** Header headline only — never inferred from experience.currentTitle. */
    headline: string | null;
    currentCompany: string | null;
    currentTitle: string | null;
    totalExperienceYears: string | null;
    summary: string | null;
  };
  experiences: ParsedResumeExperience[];
  educations: ParsedResumeEducation[];
  skills: string[];
  projects: ParsedResumeProject[];
  certifications: ParsedResumeCertification[];
};

export type ResumeParseSuccess = {
  ok: true;
  draft: ParsedResumeDraft;
  warnings: string[];
  rawTextLength: number;
};

export type ResumeParseFailure = {
  ok: false;
  error: ResumeParserError;
  draft: ParsedResumeDraft;
  warnings: string[];
};

export type ResumeParseResult = ResumeParseSuccess | ResumeParseFailure;

export const EMPTY_PARSED_RESUME_DRAFT = (): ParsedResumeDraft => ({
  personal: {
    fullName: null,
    email: null,
    phone: null,
    location: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
  },
  professional: {
    headline: null,
    currentCompany: null,
    currentTitle: null,
    totalExperienceYears: null,
    summary: null,
  },
  experiences: [],
  educations: [],
  skills: [],
  projects: [],
  certifications: [],
});

export const RESUME_PARSER_VERSION = "deterministic-v2";
