import type {
  JobEmploymentType,
  JobOpeningStatus,
  HiringTeamRole,
  RecruitmentPipelineStage,
  StageCategory,
  NoteVisibility,
} from "@/generated/prisma/enums";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import type {
  PageResult,
  PaginationInput,
  SortOptions,
} from "@/lib/recruitment/types/pagination";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";

export type JobOpeningListFilters = {
  q?: string;
  status?: JobOpeningStatus | "all";
  department?: string;
  ownerRecruiterUserId?: string;
  includeArchived?: boolean;
};

/**
 * "applicationCount" is deliberately NOT a sort field: Prisma's relation
 * `_count` ordering (ApplicationOrderByRelationAggregateInput) has no `where`,
 * so it would count soft-deleted applications while the displayed
 * Applicants column excludes them — an unfixable mismatch without raw SQL.
 */
export type JobOpeningSortField = "createdAt" | "title" | "status" | "updatedAt" | "closedAt";

export type JobOpeningSort = {
  field: JobOpeningSortField;
  direction: "asc" | "desc";
};

export type JobStageInput = {
  stage: RecruitmentPipelineStage;
  sortOrder: number;
  category?: StageCategory;
  isOptional?: boolean;
  isEnabled?: boolean;
  label?: string | null;
  slaDays?: number | null;
};

export type InsertJobStageInput = {
  stage: RecruitmentPipelineStage;
  category: StageCategory;
  label: string;
  /** Insert immediately after this stage id (mutually exclusive with beforeStageId). */
  afterStageId?: string | null;
  /** Insert immediately before this stage id (mutually exclusive with afterStageId). */
  beforeStageId?: string | null;
};

export type UpdateJobStagePatch = {
  label?: string;
  category?: StageCategory;
};

export type HiringTeamMemberInput = {
  employeeId: number;
  role: HiringTeamRole;
};

export type JobOpeningCreateData = {
  title: string;
  code?: string | null;
  status?: JobOpeningStatus;
  department?: string | null;
  location?: string | null;
  workMode?: string | null;
  employmentType?: JobEmploymentType;
  description?: string | null;
  requirements?: string | null;
  openingsCount: number;
  headcountApproved?: boolean;
  headcountRequestedByEmployeeId?: number | null;
  headcountRequestedAt?: Date | null;
  headcountUrgency?: string | null;
  compensationCurrency?: string | null;
  compensationMin?: string | null;
  compensationMax?: string | null;
  targetStartDate?: Date | null;
  pipelineTemplateId?: string | null;
  ownerRecruiterUserId?: string | null;
  createdByUserId?: string | null;
};

export type JobOpeningUpdateData = Partial<
  Omit<JobOpeningCreateData, "createdByUserId" | "status">
>;

export type JobHiringTeamMemberView = {
  id: string;
  employeeId: number;
  role: HiringTeamRole;
  employeeName: string;
  employeeCode: string;
  department: string | null;
};

export type JobOpeningStageView = {
  id: string;
  jobOpeningId: string;
  stage: RecruitmentPipelineStage;
  category: StageCategory;
  sortOrder: number;
  isOptional: boolean;
  isEnabled: boolean;
  isArchived: boolean;
  label: string | null;
  slaDays: number | null;
};

export type JobOpeningListItem = {
  id: string;
  title: string;
  code: string | null;
  status: JobOpeningStatus;
  department: string | null;
  location: string | null;
  openingsCount: number;
  employmentType: JobEmploymentType;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  publishedAt: Date | null;
  targetStartDate: Date | null;
  deletedAt: Date | null;
  ownerRecruiterUserId: string | null;
  ownerRecruiterEmail: string | null;
  hiringManagerName: string | null;
  hiringManagerEmployeeId: number | null;
  applicationCount: number;
  /** Distinct applications that have ever reached an interview stage (see INTERVIEW_STAGES). */
  interviewedApplicationCount: number;
  /** Applications with status = hired. */
  hiredApplicationCount: number;
  isPubliclyListed: boolean;
  publicSlug: string | null;
};

export type JobOpeningDetail = JobOpeningListItem & {
  workMode: string | null;
  description: string | null;
  requirements: string | null;
  skillsText: string | null;
  headcountApproved: boolean;
  headcountRequestedByEmployeeId: number | null;
  headcountRequestedByName: string | null;
  headcountRequestedAt: Date | null;
  headcountUrgency: string | null;
  compensationCurrency: string | null;
  compensationMin: string | null;
  compensationMax: string | null;
  pipelineTemplateId: string | null;
  pipelineTemplateName: string | null;
  createdByUserId: string | null;
  filledAt: Date | null;
  stages: JobOpeningStageView[];
  hiringTeam: JobHiringTeamMemberView[];
  notes: {
    id: string;
    body: string;
    visibility: NoteVisibility;
    isPinned: boolean;
    isResolved: boolean;
    authorUserId: string;
    createdAt: Date;
  }[];
};

export type JobStatusCounts = {
  total: number;
  draft: number;
  open: number;
  on_hold: number;
  closed: number;
  filled: number;
};

export type JobListArgs = {
  scope: RecruitmentScope;
  filters?: JobOpeningListFilters;
  pagination: PaginationInput;
  sort?: JobOpeningSort | SortOptions;
};

export type JobSearchArgs = {
  scope: RecruitmentScope;
  query: string;
  pagination: PaginationInput;
};

export type JobRepository = {
  createJob(
    data: JobOpeningCreateData,
    stages: readonly JobStageInput[],
    team?: readonly HiringTeamMemberInput[],
    tx?: RepositoryTx
  ): Promise<{ id: string }>;

  updateJob(id: string, patch: JobOpeningUpdateData, tx?: RepositoryTx): Promise<void>;

  archiveJob(id: string, tx?: RepositoryTx): Promise<void>;

  reopenJob(
    id: string,
    status: JobOpeningStatus,
    timestamps?: { publishedAt?: Date | null; closedAt?: Date | null; filledAt?: Date | null },
    tx?: RepositoryTx
  ): Promise<void>;

  closeJob(id: string, closedAt: Date, tx?: RepositoryTx): Promise<void>;

  changeStatus(
    id: string,
    status: JobOpeningStatus,
    meta: {
      publishedAt?: Date | null;
      closedAt?: Date | null;
      filledAt?: Date | null;
    },
    tx?: RepositoryTx
  ): Promise<void>;

  getJob(id: string, options?: { includeCompensation?: boolean }): Promise<JobOpeningDetail | null>;

  listJobs(args: JobListArgs): Promise<PageResult<JobOpeningListItem>>;

  countJobs(
    scope: RecruitmentScope,
    filters?: Pick<JobOpeningListFilters, "includeArchived" | "department">
  ): Promise<JobStatusCounts>;

  searchJobs(args: JobSearchArgs): Promise<PageResult<JobOpeningListItem>>;

  findByCode(code: string): Promise<{ id: string } | null>;

  listStages(jobId: string): Promise<readonly JobOpeningStageView[]>;

  /** Inserts a new custom stage (label/category, `stage` already resolved to a free enum slot) at the requested position, shifting siblings safely. */
  insertJobStage(
    jobId: string,
    input: InsertJobStageInput,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;

  /** Renames a stage and/or changes its category. Does not touch sortOrder/isArchived. */
  updateJobStage(stageId: string, patch: UpdateJobStagePatch, tx?: RepositoryTx): Promise<void>;

  /** Swaps a stage with its immediate left/right neighbor among the job's non-archived stages. */
  moveJobStage(stageId: string, direction: "left" | "right", tx?: RepositoryTx): Promise<void>;

  /** Sets isArchived = true. Never deletes the row or touches Application/ApplicationStageHistory. */
  archiveJobStage(stageId: string, tx?: RepositoryTx): Promise<void>;

  getJobStage(stageId: string): Promise<JobOpeningStageView | null>;

  addHiringTeamMember(
    jobId: string,
    employeeId: number,
    role: HiringTeamRole,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;

  removeHiringTeamMember(memberId: string, tx?: RepositoryTx): Promise<void>;

  countHiringManagers(jobId: string, tx?: RepositoryTx): Promise<number>;

  listHiringTeam(jobId: string): Promise<readonly JobHiringTeamMemberView[]>;

  addNote(
    jobId: string,
    data: {
      body: string;
      visibility: NoteVisibility;
      authorUserId: string;
    },
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
};
