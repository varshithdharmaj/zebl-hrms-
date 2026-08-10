import type { Prisma } from "@/generated/prisma/client";
import type {
  ApplicationPriority,
  ApplicationStatus,
  CandidateSource,
  RecruitmentPipelineStage,
} from "@/generated/prisma/enums";
import type { RecruitmentScope } from "@/lib/recruitment/types/scope";
import type {
  PageResult,
  RepositoryTx,
  ScopedListArgs,
  ScopedSearchArgs,
} from "@/lib/recruitment/repositories/types";

export type ApplicationDetailRow = Prisma.ApplicationGetPayload<{
  include: {
    candidate: {
      include: {
        personal: true;
        documents: { where: { deletedAt: null } };
      };
    };
    jobOpening: true;
    assignedRecruiter: { select: { id: true; email: true } };
    assignedManager: { select: { id: true; name: true } };
    createdBy: { select: { id: true; email: true } };
    assessmentUpdatedBy: { select: { id: true; email: true } };
    stageHistory: {
      include: {
        actor: { select: { id: true; email: true } };
      };
    };
  };
}>;

type ApplicationCandidate = NonNullable<ApplicationDetailRow["candidate"]>;
type ApplicationJobOpening = NonNullable<ApplicationDetailRow["jobOpening"]>;

export type ApplicationDetail = Omit<ApplicationDetailRow, "candidate" | "jobOpening"> & {
  candidate:
    | (Omit<ApplicationCandidate, "currentCtc" | "expectedCtc"> & {
        currentCtc: number | null;
        expectedCtc: number | null;
      })
    | null;
  jobOpening:
    | (Omit<ApplicationJobOpening, "compensationMin" | "compensationMax"> & {
        compensationMin: number | null;
        compensationMax: number | null;
      })
    | null;
};

export type ApplicationCreateData = {
  candidateId: string;
  jobOpeningId: string;
  status?: ApplicationStatus;
  currentStage?: RecruitmentPipelineStage;
  stageEnteredAt?: Date;
  priority?: ApplicationPriority;
  assignedRecruiterUserId?: string | null;
  assignedManagerEmployeeId?: number | null;
  source?: CandidateSource | null;
  riskFlagsJson?: string;
  aggregateScore?: number | null;
  createdByUserId?: string | null;
};

export type ApplicationUpdateData = {
  status?: ApplicationStatus;
  currentStage?: RecruitmentPipelineStage;
  stageEnteredAt?: Date;
  priority?: ApplicationPriority;
  assignedRecruiterUserId?: string | null;
  assignedManagerEmployeeId?: number | null;
  source?: CandidateSource | null;
  riskFlagsJson?: string;
  aggregateScore?: number | null;
  rejectedReason?: string | null;
  holdReason?: string | null;
  withdrawnReason?: string | null;
};

export type ApplicationListFilters = {
  includeArchived?: boolean;
  jobOpeningId?: string;
  candidateId?: string;
  status?: ApplicationStatus | "all";
  currentStage?: RecruitmentPipelineStage | "all";
  assignedRecruiterUserId?: string;
  assignedManagerEmployeeId?: number;
  priority?: ApplicationPriority;
  q?: string;
};

export type ApplicationRepository = {
  createApplication(data: ApplicationCreateData, tx?: RepositoryTx): Promise<{ id: string }>;
  updateApplication(id: string, patch: ApplicationUpdateData, tx?: RepositoryTx): Promise<void>;
  archiveApplication(id: string, tx?: RepositoryTx): Promise<void>;
  restoreApplication(id: string, tx?: RepositoryTx): Promise<void>;
  getApplication(id: string): Promise<ApplicationDetail | null>;
  findByCandidate(candidateId: string): Promise<readonly ApplicationDetail[]>;
  findByJob(jobOpeningId: string): Promise<readonly ApplicationDetail[]>;
  findActiveByCandidateAndJob(
    candidateId: string,
    jobOpeningId: string
  ): Promise<ApplicationDetail | null>;
  listApplications(args: ScopedListArgs): Promise<PageResult<ApplicationDetail>>;
  searchApplications(args: ScopedSearchArgs): Promise<PageResult<ApplicationDetail>>;
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
  ): Promise<ApplicationDetail>;
  countApplications(
    scope: RecruitmentScope,
    filters?: ApplicationListFilters
  ): Promise<Record<string, number>>;
};
