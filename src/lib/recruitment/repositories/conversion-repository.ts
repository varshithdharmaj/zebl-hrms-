import type { RepositoryTx } from "@/lib/recruitment/repositories/types";
import type { ApplicationStatus, RecruitmentPipelineStage, CandidateStatus, OfferStatus } from "@/generated/prisma/enums";

export type ConversionRepository = {
  convert(
    data: {
      applicationId: string;
      candidateId: string;
      offerId: string;
      employeeId: number;
      fieldMapVersion: string;
      mappedFields: Record<string, any>;
      convertedByUserId: string;
      overrideReason?: string | null;
    },
    tx?: RepositoryTx
  ): Promise<{ id: string }>;

  employeeExists(email: string, employeeCode: string): Promise<boolean>;

  updateApplication(
    id: string,
    status: ApplicationStatus,
    currentStage: RecruitmentPipelineStage,
    tx?: RepositoryTx
  ): Promise<void>;

  updateCandidate(
    id: string,
    status: CandidateStatus,
    employeeId: number,
    tx?: RepositoryTx
  ): Promise<void>;

  updateOffer(
    id: string,
    status: OfferStatus,
    tx?: RepositoryTx
  ): Promise<void>;

  incrementJobFilled(
    jobOpeningId: string,
    tx?: RepositoryTx
  ): Promise<{ filledCount: number; targetCount: number; isFilled: boolean }>;

  insertSnapshot(
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;

  findByApplicationId(applicationId: string): Promise<Record<string, unknown> | null>;
  findByCandidateId(candidateId: string): Promise<Record<string, unknown> | null>;
  findByEmployeeId(employeeId: number): Promise<Record<string, unknown> | null>;
};
