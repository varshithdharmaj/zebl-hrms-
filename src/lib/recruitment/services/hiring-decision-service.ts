import type { SessionUser } from "@/lib/session";
import {
  RecruitmentPermissionService,
  toRecruitmentActor,
} from "@/lib/recruitment/permissions/permission-service";
import { prismaApplicationRepository } from "@/lib/recruitment/repositories/prisma-application-repository";
import { prismaDecisionRepository } from "@/lib/recruitment/repositories/prisma-decision-repository";
import type {
  DecisionRepository,
  HiringDecisionRecord,
} from "@/lib/recruitment/repositories/decision-repository";
import type { ApplicationRepository } from "@/lib/recruitment/repositories/application-repository";
import { RecruitmentDomainError } from "@/lib/recruitment/shared/errors";
import { withRecruitmentTransaction } from "@/lib/recruitment/shared/transaction";
import { createAfterCommitBuffer } from "@/lib/recruitment/shared/after-commit";
import { RecruitmentEventFactory } from "@/lib/recruitment/events/factory";
import {
  submitHiringDecisionSchema,
  type SubmitHiringDecisionInput,
} from "@/lib/validation/schemas/recruitment/decisions";

export function createHiringDecisionService(
  repository: DecisionRepository = prismaDecisionRepository,
  applicationRepository: ApplicationRepository = prismaApplicationRepository
) {
  return {
    async submit(
      session: SessionUser,
      input: SubmitHiringDecisionInput
    ): Promise<HiringDecisionRecord> {
      RecruitmentPermissionService.requireModuleEnabled();
      const parsed = submitHiringDecisionSchema.parse(input);
      await RecruitmentPermissionService.assertCanSubmitHiringDecision(
        session,
        parsed.applicationId
      );

      const application = await applicationRepository.getApplication(parsed.applicationId);
      if (!application || application.deletedAt) {
        throw new RecruitmentDomainError("REC_NOT_FOUND", "Application not found.");
      }

      const actor = toRecruitmentActor(session);
      const events = createAfterCommitBuffer();

      const decision = await withRecruitmentTransaction(async (tx) => {
        const created = await repository.appendDecision(
          {
            applicationId: parsed.applicationId,
            outcome: parsed.outcome,
            rationale: parsed.rationale,
            strengths: parsed.strengths,
            concerns: parsed.concerns ?? null,
            salaryRecommendation: parsed.salaryRecommendation ?? null,
            currency: parsed.currency ?? null,
            decidedByUserId: session.id,
          },
          tx
        );

        events.enqueue(
          RecruitmentEventFactory.hiringDecisionSubmitted(actor, {
            decisionId: created.id,
            applicationId: created.applicationId,
            outcome: created.outcome,
            version: created.version,
          })
        );

        return created;
      });

      await events.flush();
      return decision;
    },

    async getCurrent(
      session: SessionUser,
      applicationId: string
    ): Promise<HiringDecisionRecord | null> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanViewApplication(session, applicationId);
      return repository.findCurrent(applicationId);
    },

    async list(
      session: SessionUser,
      applicationId: string
    ): Promise<readonly HiringDecisionRecord[]> {
      RecruitmentPermissionService.requireModuleEnabled();
      await RecruitmentPermissionService.assertCanViewApplication(session, applicationId);
      return repository.listByApplication(applicationId);
    },
  };
}

export type HiringDecisionService = ReturnType<typeof createHiringDecisionService>;
