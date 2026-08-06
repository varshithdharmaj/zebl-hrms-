import type {
  CandidateStatus,
  CandidateSource,
  PreferredWorkMode,
  RecruitmentDocumentType,
  NoteVisibility,
} from "@/generated/prisma/enums";
import type {
  PageResult,
  PaginationInput,
  SortOptions,
} from "@/lib/recruitment/types/pagination";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";

export type CandidatePersonalInput = {
  nationality?: string | null;
  currentLocation?: string | null;
  preferredLocation?: string | null;
  noticePeriod?: string | null;
  availabilityDate?: Date | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
};

export type CandidateExperienceInput = {
  id?: string;
  company: string;
  title: string;
  location?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  isCurrent?: boolean;
  description?: string | null;
  sortOrder?: number;
  companyName?: string | null;
  designation?: string | null;
  employmentType?: string | null;
  currentlyWorking?: boolean;
};

export type CandidateEducationInput = {
  id?: string;
  institution: string;
  degree?: string | null;
  field?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  notes?: string | null;
  sortOrder?: number;
  fieldOfStudy?: string | null;
  grade?: string | null;
};

export type CandidateSkillInput = {
  id?: string;
  name: string;
  proficiency?: string | null;
  isConfirmed?: boolean;
  skillName?: string | null;
  yearsOfExperience?: number | null;
};

export type CandidateProjectInput = {
  id?: string;
  title: string;
  summary?: string | null;
  techStack?: string | null;
  url?: string | null;
  sortOrder?: number;
  description?: string | null;
  technologies?: string | null;
  role?: string | null;
  duration?: string | null;
};

export type CandidateCertificationInput = {
  id?: string;
  name: string;
  issuer?: string | null;
  issuedAt?: Date | null;
  expiresAt?: Date | null;
  credentialId?: string | null;
  issueDate?: Date | null;
  expiryDate?: Date | null;
  credentialUrl?: string | null;
};

export type CandidateDocumentInput = {
  id?: string;
  documentType: RecruitmentDocumentType;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey: string;
  checksum?: string | null;
  version?: number;
  isPrimary?: boolean;
  uploadedByUserId?: string | null;
  fileType?: string | null;
  storagePath?: string | null;
  size?: number | null;
};

export type CandidateNoteInput = {
  id?: string;
  body: string;
  visibility?: NoteVisibility;
  isPinned?: boolean;
  isResolved?: boolean;
  authorUserId: string;
  content?: string | null;
};

export type CandidateCreateData = {
  tenantId?: string | null;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  dateOfBirth?: Date | null;
  location?: string | null;
  currentCompany?: string | null;
  currentTitle?: string | null;
  linkedinUrl?: string | null;
  professionalSummary?: string | null;
  headline?: string | null;
  totalExperienceYears?: string | null;
  githubUrl?: string | null;
  preferredWorkMode?: PreferredWorkMode | null;
  willingToRelocate?: boolean | null;
  /** Form convenience — mapped to CandidatePersonal in service */
  preferredLocation?: string | null;
  /** Form convenience — mapped to CandidatePersonal in service */
  portfolioUrl?: string | null;
  /** Form convenience — mapped to CandidatePersonal in service */
  nationality?: string | null;
  source?: CandidateSource;
  status?: CandidateStatus;
  doNotHireReason?: string | null;
  currentCtc?: string | null;
  expectedCtc?: string | null;
  currency?: string | null;
  noticePeriodDays?: number | null;
  earliestJoinDate?: Date | null;
  availabilityNotes?: string | null;
  timezone?: string | null;
  primaryRecruiterUserId?: string | null;
  referredByEmployeeId?: number | null;
  createdByUserId?: string | null;
  normalizedEmail?: string | null;
  normalizedPhone?: string | null;

  personal?: CandidatePersonalInput;
  experiences?: CandidateExperienceInput[];
  educations?: CandidateEducationInput[];
  skills?: CandidateSkillInput[];
  projects?: CandidateProjectInput[];
  certifications?: CandidateCertificationInput[];
  documents?: CandidateDocumentInput[];
  notes?: CandidateNoteInput[];
};

export type CandidateUpdateData = Partial<Omit<CandidateCreateData, "createdByUserId">>;

export type CandidatePersonalView = {
  candidateId: string;
  nationality: string | null;
  currentLocation: string | null;
  preferredLocation: string | null;
  noticePeriod: string | null;
  availabilityDate: Date | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
};

export type CandidateExperienceView = {
  id: string;
  candidateId: string;
  company: string;
  title: string;
  location: string | null;
  startDate: Date | null;
  endDate: Date | null;
  isCurrent: boolean;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  companyName: string | null;
  designation: string | null;
  employmentType: string | null;
  currentlyWorking: boolean | null;
};

export type CandidateEducationView = {
  id: string;
  candidateId: string;
  institution: string;
  degree: string | null;
  field: string | null;
  startYear: number | null;
  endYear: number | null;
  notes: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  fieldOfStudy: string | null;
  grade: string | null;
};

export type CandidateSkillView = {
  id: string;
  candidateId: string;
  name: string;
  proficiency: string | null;
  isConfirmed: boolean;
  createdAt: Date;
  skillName: string | null;
  yearsOfExperience: number | null;
};

export type CandidateProjectView = {
  id: string;
  candidateId: string;
  title: string;
  summary: string | null;
  techStack: string | null;
  url: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  description: string | null;
  technologies: string | null;
  role: string | null;
  duration: string | null;
};

export type CandidateCertificationView = {
  id: string;
  candidateId: string;
  name: string;
  issuer: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  credentialId: string | null;
  createdAt: Date;
  issueDate: Date | null;
  expiryDate: Date | null;
  credentialUrl: string | null;
};

export type CandidateDocumentView = {
  id: string;
  candidateId: string;
  documentType: RecruitmentDocumentType;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storageKey: string;
  checksum: string | null;
  version: number;
  isPrimary: boolean;
  uploadedByUserId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  fileType: string | null;
  storagePath: string | null;
  size: number | null;
};

export type CandidateNoteView = {
  id: string;
  candidateId: string;
  body: string;
  visibility: NoteVisibility;
  isPinned: boolean;
  isResolved: boolean;
  authorUserId: string;
  authorName: string;
  authorEmail: string;
  avatarUrl: string | null;
  roleLabel: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  content: string | null;
};

export type CandidateDetail = {
  id: string;
  tenantId: string | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  dateOfBirth: Date | null;
  location: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  linkedinUrl: string | null;
  professionalSummary: string | null;
  headline: string | null;
  totalExperienceYears: string | null;
  githubUrl: string | null;
  preferredWorkMode: PreferredWorkMode | null;
  willingToRelocate: boolean | null;
  source: CandidateSource;
  status: CandidateStatus;
  doNotHireReason: string | null;
  currentCtc: string | null;
  expectedCtc: string | null;
  currency: string | null;
  noticePeriodDays: number | null;
  earliestJoinDate: Date | null;
  availabilityNotes: string | null;
  timezone: string | null;
  primaryRecruiterUserId: string | null;
  referredByEmployeeId: number | null;
  employeeId: number | null;
  mergedIntoCandidateId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  archivedAt: Date | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;

  personal?: CandidatePersonalView | null;
  experiences: CandidateExperienceView[];
  educations: CandidateEducationView[];
  skills: CandidateSkillView[];
  projects: CandidateProjectView[];
  certifications: CandidateCertificationView[];
  documents: CandidateDocumentView[];
  notes: CandidateNoteView[];
};

export type CandidateListItem = {
  id: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  headline: string | null;
  totalExperienceYears: string | null;
  source: CandidateSource;
  status: CandidateStatus;
  createdAt: Date;
  updatedAt: Date;
  primaryRecruiterUserId?: string | null;
};

export type CandidateListFilters = {
  q?: string;
  status?: CandidateStatus | "all";
  source?: CandidateSource | "all";
  includeArchived?: boolean;
  createdBy?: string;
  primaryRecruiter?: string;
  startDate?: Date;
  endDate?: Date;
};

export type CandidateSortField = "createdAt" | "fullName" | "status" | "updatedAt";

export type CandidateSort = {
  field: CandidateSortField;
  direction: "asc" | "desc";
};

export type CandidateStatusCounts = {
  total: number;
  active: number;
  talent_pool: number;
  hired: number;
  archived: number;
  merged: number;
};

export type CandidateListArgs = {
  filters?: CandidateListFilters;
  pagination?: PaginationInput;
  sort?: CandidateSort;
};

export type CandidateSearchArgs = {
  q: string;
  pagination?: PaginationInput;
};
