import type { HiringDecisionOutcome } from "@/generated/prisma/enums";
import type { RepositoryTx } from "@/lib/recruitment/repositories/types";

export type HiringDecisionRecord = {
  id: string;
  applicationId: string;
  outcome: HiringDecisionOutcome;
  rationale: string;
  strengths: string;
  concerns: string | null;
  salaryRecommendation: number | null;
  currency: string | null;
  version: number;
  isCurrent: boolean;
  decidedByUserId: string;
  decidedByEmail: string | null;
  decidedAt: Date;
  createdAt: Date;
};

export type AppendHiringDecisionData = {
  applicationId: string;
  outcome: HiringDecisionOutcome;
  rationale: string;
  strengths: string;
  concerns?: string | null;
  salaryRecommendation?: number | null;
  currency?: string | null;
  decidedByUserId: string;
};

export type DecisionRepository = {
  appendDecision(
    data: AppendHiringDecisionData,
    tx?: RepositoryTx
  ): Promise<HiringDecisionRecord>;
  findCurrent(applicationId: string): Promise<HiringDecisionRecord | null>;
  listByApplication(applicationId: string): Promise<readonly HiringDecisionRecord[]>;
};
