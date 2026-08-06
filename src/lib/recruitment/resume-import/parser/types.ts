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
};

export type ParsedResumeExperience = {
  company: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
};

export type ParsedResumeEducation = {
  institution: string;
  degree: string | null;
  graduationYear: number | null;
};

export type ParsedResumeDraft = {
  personal: ParsedResumePersonal;
  professional: {
    currentCompany: string | null;
    currentTitle: string | null;
    totalExperienceYears: string | null;
    summary: string | null;
  };
  experiences: ParsedResumeExperience[];
  educations: ParsedResumeEducation[];
  skills: string[];
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
  },
  professional: {
    currentCompany: null,
    currentTitle: null,
    totalExperienceYears: null,
    summary: null,
  },
  experiences: [],
  educations: [],
  skills: [],
});

export const RESUME_PARSER_VERSION = "deterministic-v1";
