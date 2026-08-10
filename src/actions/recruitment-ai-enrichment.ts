"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  acceptCandidateAiEnrichmentSchema,
  dismissCandidateAiEnrichmentSchema,
  generateCandidateAiEnrichmentSchema,
} from "@/lib/validation/schemas/recruitment/ai-enrichment";
import { createCandidateAiEnrichmentService } from "@/lib/recruitment/services/candidate-ai-enrichment-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type AiEnrichmentActionState = ActionState & {
  insightId?: string;
  applied?: string[];
  reused?: boolean;
};

function revalidateCandidate(candidateId: string) {
  revalidatePath(`/admin/recruitment/candidates/${candidateId}`);
}

export async function generateCandidateAiEnrichmentAction(
  _prev: AiEnrichmentActionState,
  input: unknown
): Promise<AiEnrichmentActionState> {
  try {
    const parsed = safeParseWithSchema(generateCandidateAiEnrichmentSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateAiEnrichmentService();
    const result = await service.generateFromResumeDraft({
      candidateId: parsed.data.candidateId,
      sourceDraftId: parsed.data.sourceDraftId,
      session,
      force: parsed.data.force ?? true,
    });

    revalidateCandidate(parsed.data.candidateId);
    return {
      success: result.reused
        ? "Existing AI enrichment reused."
        : "AI enrichment generated.",
      insightId: result.insightId,
      reused: result.reused,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function dismissCandidateAiEnrichmentAction(
  _prev: AiEnrichmentActionState,
  input: unknown
): Promise<AiEnrichmentActionState> {
  try {
    const parsed = safeParseWithSchema(dismissCandidateAiEnrichmentSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateAiEnrichmentService();
    await service.dismissEnrichment(session, {
      insightId: parsed.data.insightId,
      candidateId: parsed.data.candidateId,
    });

    revalidateCandidate(parsed.data.candidateId);
    return { success: "AI enrichment dismissed." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function acceptCandidateAiEnrichmentAction(
  _prev: AiEnrichmentActionState,
  input: unknown
): Promise<AiEnrichmentActionState> {
  try {
    const parsed = safeParseWithSchema(acceptCandidateAiEnrichmentSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateAiEnrichmentService();
    const result = await service.acceptEnrichmentFields(session, {
      insightId: parsed.data.insightId,
      candidateId: parsed.data.candidateId,
      acceptSummary: parsed.data.acceptSummary,
      acceptHeadline: parsed.data.acceptHeadline,
      replaceSummary: parsed.data.replaceSummary,
      replaceHeadline: parsed.data.replaceHeadline,
      editedSummary: parsed.data.editedSummary,
      editedHeadline: parsed.data.editedHeadline,
    });

    revalidateCandidate(parsed.data.candidateId);
    return {
      success: "AI suggestions applied to candidate profile.",
      applied: result.applied,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
