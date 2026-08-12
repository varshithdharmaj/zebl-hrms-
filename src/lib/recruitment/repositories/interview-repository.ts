import type { Prisma } from "@/generated/prisma/client";
import type {
  InterviewRoundType,
  InterviewStatus,
} from "@/generated/prisma/enums";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import type {
  PageResult,
  RepositoryTx,
  ScopedSearchArgs,
} from "@/lib/recruitment/repositories/types";
import type { PaginationInput, SearchFilters, SortOptions } from "@/lib/recruitment/types/pagination";

export type InterviewDetailRow = Prisma.InterviewGetPayload<{
  include: {
    application: {
      include: {
        candidate: true;
        jobOpening: true;
      };
    };
    panelists: {
      include: {
        employee: {
          select: { id: true; name: true; user: { select: { id: true; email: true } } };
        };
      };
    };
    feedback: {
      include: {
        author: {
          select: { id: true; name: true; user: { select: { id: true; email: true } } };
        };
      };
    };
    attachments: true;
  };
}>;

type InterviewApplication = NonNullable<InterviewDetailRow["application"]>;
type InterviewCandidate = NonNullable<InterviewApplication["candidate"]>;
type InterviewJobOpening = NonNullable<InterviewApplication["jobOpening"]>;

type MappedInterviewApplication = Omit<InterviewApplication, "candidate" | "jobOpening"> & {
  candidate:
    | (Omit<InterviewCandidate, "currentCtc" | "expectedCtc" | "totalExperienceYears"> & {
        currentCtc: number | null;
        expectedCtc: number | null;
        totalExperienceYears: number | null;
      })
    | null;
  jobOpening:
    | (Omit<InterviewJobOpening, "compensationMin" | "compensationMax"> & {
        compensationMin: number | null;
        compensationMax: number | null;
      })
    | null;
};

export type InterviewDetail = Omit<InterviewDetailRow, "application"> & {
  application: MappedInterviewApplication | null;
};

/** Lean row shape for list/search/schedule queries — omits feedback + attachments. */
export type InterviewListRow = Prisma.InterviewGetPayload<{
  include: {
    application: {
      select: {
        id: true;
        candidateId: true;
        jobOpeningId: true;
        candidate: {
          select: { id: true; fullName: true; email: true };
        };
        jobOpening: {
          select: { id: true; title: true; location: true };
        };
      };
    };
    panelists: {
      select: {
        id: true;
        employeeId: true;
        employee: { select: { id: true; name: true } };
      };
    };
  };
}>;

type InterviewListApplication = NonNullable<InterviewListRow["application"]>;
type InterviewListCandidate = NonNullable<InterviewListApplication["candidate"]>;
type InterviewListJobOpening = NonNullable<InterviewListApplication["jobOpening"]>;

export type InterviewListItem = Omit<InterviewListRow, "application" | "panelists"> & {
  application:
    | (Omit<InterviewListApplication, "candidate" | "jobOpening"> & {
        candidate: InterviewListCandidate | null;
        jobOpening: InterviewListJobOpening | null;
      })
    | null;
  panelists: InterviewListRow["panelists"];
  feedback: readonly [];
  attachments: readonly [];
};

export type InterviewFeedbackRow = Prisma.InterviewFeedbackGetPayload<{
  include: {
    author: { select: { id: true; name: true } };
  };
}>;

export type InterviewCreateData = {
  applicationId: string;
  roundType: InterviewRoundType;
  status?: InterviewStatus;
  title?: string | null;
  scheduledStart?: Date | string | null;
  scheduledEnd?: Date | string | null;
  timezone?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  summary?: string | null;
  createdByUserId?: string | null;
  panelistEmployeeIds?: number[];
};

export type InterviewUpdateData = {
  roundType?: InterviewRoundType;
  status?: InterviewStatus;
  title?: string | null;
  scheduledStart?: Date | string | null;
  scheduledEnd?: Date | string | null;
  timezone?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  summary?: string | null;
  panelistEmployeeIds?: number[];
};

export type InterviewAttachmentCreateData = {
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  storageKey: string;
  uploadedByUserId?: string | null;
};

export type InterviewFeedbackSubmitData = {
  overallRating?: number | null;
  ratingsJson?: Prisma.InputJsonValue;
  recommendation?: string | null;
  strengths?: string | null;
  concerns?: string | null;
  privateNotes?: string | null;
};

export type InterviewListFilters = {
  includeArchived?: boolean;
  status?: InterviewStatus | "all";
  roundType?: InterviewRoundType | "all";
  applicationId?: string;
  /** Restrict to interviews for applications of this candidate. */
  candidateId?: string;
  q?: string;
  /** Inclusive lower bound on scheduledStart (calendar / range queries). */
  scheduledStartFrom?: Date | string;
  /** Inclusive upper bound on scheduledStart (calendar / range queries). */
  scheduledStartTo?: Date | string;
};

export type InterviewListArgs = {
  scope: RecruitmentScope;
  filters?: InterviewListFilters | SearchFilters;
  pagination: PaginationInput;
  sort?: SortOptions;
};

export type InterviewRepository = {
  createInterview(data: InterviewCreateData, tx?: RepositoryTx): Promise<{ id: string }>;
  updateInterview(id: string, patch: InterviewUpdateData, tx?: RepositoryTx): Promise<void>;
  archiveInterview(id: string, tx?: RepositoryTx): Promise<void>;
  restoreInterview(id: string, tx?: RepositoryTx): Promise<void>;
  getInterview(id: string): Promise<InterviewDetail | null>;
  listInterviews(args: InterviewListArgs): Promise<PageResult<InterviewListItem>>;
  searchInterviews(args: ScopedSearchArgs): Promise<PageResult<InterviewListItem>>;
  listByApplication(applicationId: string): Promise<readonly InterviewListItem[]>;
  listByScheduleRange(
    args: InterviewListArgs & { rangeStart: Date; rangeEnd: Date }
  ): Promise<PageResult<InterviewListItem>>;
  replacePanelists(
    interviewId: string,
    employeeIds: readonly number[],
    tx?: RepositoryTx
  ): Promise<void>;
  addAttachment(
    interviewId: string,
    data: InterviewAttachmentCreateData,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  softDeleteAttachment(attachmentId: string, tx?: RepositoryTx): Promise<void>;
  submitFeedback(
    interviewId: string,
    authorEmployeeId: number,
    data: InterviewFeedbackSubmitData,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  listFeedback(interviewId: string): Promise<readonly InterviewFeedbackRow[]>;
  findFeedback(feedbackId: string): Promise<InterviewFeedbackRow | null>;
  countInterviews(
    scope: RecruitmentScope,
    filters?: InterviewListFilters
  ): Promise<Record<string, number>>;
};
