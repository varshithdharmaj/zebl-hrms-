"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { scheduleCandidateAiFieldRecovery } from "@/lib/recruitment/ai/schedule-recovery";
import {
  createCandidateFromResumeService,
  RESUME_ATTACH_FAILURE_MESSAGE,
} from "@/lib/recruitment/services/create-candidate-from-resume-service";
import type { NewCandidateResumeReviewDraft } from "@/lib/recruitment/services/create-candidate-from-resume-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { RESUME_UPLOAD_MAX_BYTES } from "@/lib/recruitment/resume-import/file-validation";

export type ParseNewCandidateResumeActionState = ActionState & {
  draft?: NewCandidateResumeReviewDraft;
};

export type CreateCandidateFromResumeActionState = ActionState & {
  candidateId?: string;
  resumeAttached?: boolean;
  resumeAttachmentError?: string;
  duplicateCandidateId?: string;
};

function revalidateAfterCreate(candidateId: string) {
  revalidatePath("/admin/recruitment/candidates");
  revalidatePath(`/admin/recruitment/candidates/${candidateId}`);
  revalidatePath("/admin/recruitment");
}

/**
 * Upload + deterministic-v2 parse for new-candidate flow.
 * Does not create a Candidate.
 */
export async function parseResumeForNewCandidateAction(
  formData: FormData
): Promise<ParseNewCandidateResumeActionState> {
  try {
    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { error: "Resume file is required." };
    }
    if (file.size <= 0) {
      return { error: "The selected file is empty." };
    }
    if (file.size > RESUME_UPLOAD_MAX_BYTES) {
      return { error: "File is too large. Maximum size is 10 MB." };
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const service = createCandidateFromResumeService();
    const draft = await service.parseForNewCandidate(session, {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      content: bytes,
    });

    return {
      success: draft.parseOk
        ? "Resume extracted. Review the information before creating the candidate."
        : "Could not extract readable text from this resume. Please enter candidate details manually.",
      draft,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

/**
 * Create Candidate from recruiter-reviewed single-pass resume fields + intake resume.
 *
 * aiInsights are already persisted (same transaction as the candidate row — see
 * createFromReview / candidateService.createCandidate). No secondary enrichment call:
 * candidate-ai-enrichment-service.ts is on-demand only now (e.g. re-scoring against a
 * JD attached after creation), never auto-invoked from initial candidate creation.
 *
 * Field recovery (filling genuinely missing fields post-creation) is a separate
 * concern and still runs.
 */
export async function createCandidateFromResumeReviewAction(
  _prev: CreateCandidateFromResumeActionState,
  input: unknown
): Promise<CreateCandidateFromResumeActionState> {
  try {
    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateFromResumeService();
    const result = await service.createFromReview(session, input);

    if (result.resumeAttached && result.sourceDraftId) {
      scheduleCandidateAiFieldRecovery({
        candidateId: result.candidateId,
        sourceDraftId: result.sourceDraftId,
        createdByUserId: session.id,
      });
    }

    revalidateAfterCreate(result.candidateId);

    if (!result.resumeAttached) {
      return {
        success: "Candidate created.",
        candidateId: result.candidateId,
        resumeAttached: false,
        resumeAttachmentError:
          result.resumeAttachmentError ?? RESUME_ATTACH_FAILURE_MESSAGE,
      };
    }

    return {
      success: "Candidate created from resume.",
      candidateId: result.candidateId,
      resumeAttached: true,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
