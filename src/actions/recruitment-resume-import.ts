"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  createResumeImportDraftSchema,
  resumeImportDraftIdSchema,
  applyResumeImportSchema,
} from "@/lib/validation/schemas/recruitment";
import { createResumeImportService } from "@/lib/recruitment/services/resume-import-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type ResumeImportActionState = ActionState & {
  draftId?: string;
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
