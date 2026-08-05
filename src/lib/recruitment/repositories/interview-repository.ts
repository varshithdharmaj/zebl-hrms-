import type {
  InterviewRoundType,
  InterviewStatus,
} from "@/generated/prisma/enums";
import type {
  PageResult,
  RepositoryTx,
  ScopedListArgs,
  ScopedSearchArgs,
} from "@/lib/recruitment/repositories/types";

export type InterviewRepository = {
  createInterview(data: Record<string, any>, tx?: RepositoryTx): Promise<{ id: string }>;
  updateInterview(id: string, patch: Record<string, any>, tx?: RepositoryTx): Promise<void>;
  archiveInterview(id: string, tx?: RepositoryTx): Promise<void>;
  restoreInterview(id: string, tx?: RepositoryTx): Promise<void>;
  getInterview(id: string): Promise<Record<string, any> | null>;
  listInterviews(args: ScopedListArgs): Promise<PageResult<Record<string, any>>>;
  searchInterviews(args: ScopedSearchArgs): Promise<PageResult<Record<string, any>>>;
  listByApplication(applicationId: string): Promise<readonly Record<string, any>[]>;
  listByScheduleRange(
    args: ScopedListArgs & { rangeStart: Date; rangeEnd: Date }
  ): Promise<PageResult<Record<string, any>>>;
  replacePanelists(
    interviewId: string,
    employeeIds: readonly number[],
    tx?: RepositoryTx
  ): Promise<void>;
  addAttachment(
    interviewId: string,
    data: Record<string, any>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  softDeleteAttachment(attachmentId: string, tx?: RepositoryTx): Promise<void>;
  submitFeedback(
    interviewId: string,
    authorEmployeeId: number,
    data: Record<string, any>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  listFeedback(interviewId: string): Promise<readonly Record<string, any>[]>;
  findFeedback(feedbackId: string): Promise<Record<string, any> | null>;
  countInterviews(scope: any, filters?: any): Promise<Record<string, number>>;
};
