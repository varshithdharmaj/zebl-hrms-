import type {
  ApplicationPriority,
  ApplicationStatus,
  RecruitmentPipelineStage,
} from "@/generated/prisma/enums";
import type {
  PageResult,
  RepositoryTx,
  ScopedListArgs,
  ScopedSearchArgs,
} from "@/lib/recruitment/repositories/types";

export type ApplicationRepository = {
  createApplication(data: Record<string, any>, tx?: RepositoryTx): Promise<{ id: string }>;
  updateApplication(id: string, patch: Record<string, any>, tx?: RepositoryTx): Promise<void>;
  archiveApplication(id: string, tx?: RepositoryTx): Promise<void>;
  restoreApplication(id: string, tx?: RepositoryTx): Promise<void>;
  getApplication(id: string): Promise<Record<string, any> | null>;
  findByCandidate(candidateId: string): Promise<readonly Record<string, any>[]>;
  findByJob(jobOpeningId: string): Promise<readonly Record<string, any>[]>;
  findActiveByCandidateAndJob(
    candidateId: string,
    jobOpeningId: string
  ): Promise<Record<string, any> | null>;
  listApplications(args: ScopedListArgs): Promise<PageResult<Record<string, any>>>;
  searchApplications(args: ScopedSearchArgs): Promise<PageResult<Record<string, any>>>;
  assignRecruiter(
    id: string,
    recruiterUserId: string | null,
    tx?: RepositoryTx
  ): Promise<void>;
  assignManager(
    id: string,
    managerEmployeeId: number | null,
    tx?: RepositoryTx
  ): Promise<void>;
  setPriority(id: string, priority: ApplicationPriority, tx?: RepositoryTx): Promise<void>;
  setStatus(id: string, status: ApplicationStatus, tx?: RepositoryTx): Promise<void>;
  setAggregateScore(id: string, score: number | null, tx?: RepositoryTx): Promise<void>;
  moveApplicationStage(
    id: string,
    stage: RecruitmentPipelineStage,
    stageEnteredAt: Date,
    status?: ApplicationStatus,
    tx?: RepositoryTx
  ): Promise<void>;
  updateAssessment(
    id: string,
    data: {
      assessment: string | null;
      assessmentUpdatedAt: Date | null;
      assessmentUpdatedByUserId: string | null;
    },
    tx?: RepositoryTx
  ): Promise<Record<string, any>>;
  countApplications(
    scope: any,
    filters?: any
  ): Promise<Record<string, number>>;
};
