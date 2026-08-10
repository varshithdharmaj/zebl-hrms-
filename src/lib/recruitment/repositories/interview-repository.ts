import type { Prisma } from "@/generated/prisma/client";
import type {
  InterviewRoundType,
  InterviewStatus,
} from "@/generated/prisma/enums";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import type {
  PageResult,
  RepositoryTx,
  ScopedListArgs,
  ScopedSearchArgs,
} from "@/lib/recruitment/repositories/types";

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
};

export type InterviewRepository = {
  createInterview(data: InterviewCreateData, tx?: RepositoryTx): Promise<{ id: string }>;
  updateInterview(id: string, patch: InterviewUpdateData, tx?: RepositoryTx): Promise<void>;
  archiveInterview(id: string, tx?: RepositoryTx): Promise<void>;
  restoreInterview(id: string, tx?: RepositoryTx): Promise<void>;
  getInterview(id: string): Promise<InterviewDetail | null>;
  listInterviews(args: ScopedListArgs): Promise<PageResult<InterviewDetail>>;
  searchInterviews(args: ScopedSearchArgs): Promise<PageResult<InterviewDetail>>;
  listByApplication(applicationId: string): Promise<readonly InterviewDetail[]>;
  listByScheduleRange(
    args: ScopedListArgs & { rangeStart: Date; rangeEnd: Date }
  ): Promise<PageResult<InterviewDetail>>;
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
