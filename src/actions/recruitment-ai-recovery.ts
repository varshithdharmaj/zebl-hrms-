"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  acceptCandidateAiRecoverySchema,
  dismissCandidateAiRecoverySchema,
  generateCandidateAiRecoverySchema,
} from "@/lib/validation/schemas/recruitment/ai-recovery";
import { createCandidateAiRecoveryService } from "@/lib/recruitment/services/candidate-ai-recovery-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type AiRecoveryActionState = ActionState & {
  insightId?: string;
  applied?: string[];
  skipped?: string[];
  reused?: boolean;
};

function revalidateCandidate(candidateId: string) {
  revalidatePath(`/admin/recruitment/candidates/${candidateId}`);
}

export async function generateCandidateAiRecoveryAction(
  _prev: AiRecoveryActionState,
  input: unknown
): Promise<AiRecoveryActionState> {
  try {
    const parsed = safeParseWithSchema(generateCandidateAiRecoverySchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateAiRecoveryService();
    const result = await service.generateFromResumeDraft({
      candidateId: parsed.data.candidateId,
      sourceDraftId: parsed.data.sourceDraftId,
      session,
      force: parsed.data.force ?? true,
    });

    if (result.skipped) {
      return { error: result.skipped };
    }

    revalidateCandidate(parsed.data.candidateId);
    return {
      success: result.reused
        ? "Existing AI field recovery reused."
        : "AI field recovery generated.",
      insightId: result.insightId,
      reused: result.reused,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function dismissCandidateAiRecoveryAction(
  _prev: AiRecoveryActionState,
  input: unknown
): Promise<AiRecoveryActionState> {
  try {
    const parsed = safeParseWithSchema(dismissCandidateAiRecoverySchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateAiRecoveryService();
    await service.dismissRecovery(session, {
      insightId: parsed.data.insightId,
      candidateId: parsed.data.candidateId,
    });

    revalidateCandidate(parsed.data.candidateId);
    return { success: "AI field recovery dismissed." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function acceptCandidateAiRecoveryAction(
  _prev: AiRecoveryActionState,
  input: unknown
): Promise<AiRecoveryActionState> {
  try {
    const parsed = safeParseWithSchema(acceptCandidateAiRecoverySchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateAiRecoveryService();
    const result = await service.acceptRecoveryProposals(session, {
      insightId: parsed.data.insightId,
      candidateId: parsed.data.candidateId,
      proposalIds: parsed.data.proposalIds,
      editedValues: parsed.data.editedValues,
    });

    revalidateCandidate(parsed.data.candidateId);
    return {
      success: "AI field recovery applied to candidate profile.",
      applied: result.applied,
      skipped: result.skipped,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
