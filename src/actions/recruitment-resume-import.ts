"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  createResumeImportDraftSchema,
  resumeImportDraftIdSchema,
  applyResumeImportSchema,
  prepareCandidateResumeMergeSchema,
  mergeCandidateResumeSchema,
} from "@/lib/validation/schemas/recruitment";
import { createResumeImportService } from "@/lib/recruitment/services/resume-import-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import type { ResumeMergeResult } from "@/lib/recruitment/resume-import";

export type ResumeImportActionState = ActionState & {
  draftId?: string;
};

export type PrepareResumeMergeActionState = ActionState & {
  draftId?: string;
  candidateId?: string;
  documentId?: string;
  hasWork?: boolean;
  merge?: ResumeMergeResult;
};

export type MergeCandidateResumeActionState = ActionState & {
  appliedFields?: string[];
  appended?: string[];
};

function revalidateImportPaths(candidateId: string, draftId?: string) {
  revalidatePath(`/admin/recruitment/candidates/${candidateId}`);
  if (draftId) {
    revalidatePath(
      `/admin/recruitment/candidates/${candidateId}/resume-import/${draftId}`
    );
  }
}

export async function createResumeImportDraftAction(
  _prev: ResumeImportActionState,
  input: unknown
): Promise<ResumeImportActionState> {
  try {
    const parsed = safeParseWithSchema(createResumeImportDraftSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createResumeImportService();
    const { id } = await service.createDraft(session, {
      candidateId: parsed.data.candidateId,
      documentId: parsed.data.documentId ?? null,
    });

    revalidateImportPaths(parsed.data.candidateId, id);
    return {
      success: "Resume import draft created.",
      draftId: id,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function dismissResumeImportDraftAction(
  _prev: ResumeImportActionState,
  input: unknown
): Promise<ResumeImportActionState> {
  try {
    const parsed = safeParseWithSchema(resumeImportDraftIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createResumeImportService();
    await service.dismissDraft(session, parsed.data.draftId);

    revalidateImportPaths(parsed.data.candidateId, parsed.data.draftId);
    return { success: "Resume import draft dismissed." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function applyResumeImportDraftAction(
  _prev: ResumeImportActionState,
  input: unknown
): Promise<ResumeImportActionState> {
  try {
    const parsed = safeParseWithSchema(applyResumeImportSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createResumeImportService();
    await service.applyDraft(session, parsed.data);

    revalidateImportPaths(parsed.data.candidateId, parsed.data.draftId);
    return { success: "Resume import applied to candidate profile." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

/**
 * After a resume document upload: create parse draft + return merge plan.
 * Does not write profile fields yet.
 */
export async function prepareCandidateResumeMergeAction(
  _prev: PrepareResumeMergeActionState,
  input: unknown
): Promise<PrepareResumeMergeActionState> {
  try {
    const parsed = safeParseWithSchema(prepareCandidateResumeMergeSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createResumeImportService();
    const preview = await service.prepareMerge(session, parsed.data);

    revalidateImportPaths(preview.candidateId, preview.draftId);
    return {
      success: preview.hasWork
        ? "Resume parsed. Review conflicts if any, then apply."
        : "Resume uploaded. No new profile details to merge.",
      draftId: preview.draftId,
      candidateId: preview.candidateId,
      documentId: preview.documentId,
      hasWork: preview.hasWork,
      merge: preview.merge,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

/**
 * Apply auto-fill + conflict resolutions + append-only lists in one transaction.
 */
export async function mergeCandidateResumeAction(
  _prev: MergeCandidateResumeActionState,
  input: unknown
): Promise<MergeCandidateResumeActionState> {
  try {
    const parsed = safeParseWithSchema(mergeCandidateResumeSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createResumeImportService();
    const result = await service.applyMerge(session, {
      draftId: parsed.data.draftId,
      candidateId: parsed.data.candidateId,
      conflictSelections: parsed.data.conflictSelections ?? {},
    });

    revalidateImportPaths(parsed.data.candidateId, parsed.data.draftId);
    return {
      success: "Candidate profile updated from resume.",
      appliedFields: result.appliedFields,
      appended: result.appended,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
