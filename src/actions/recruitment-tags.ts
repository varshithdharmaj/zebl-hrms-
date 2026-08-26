"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { addCandidateTagSchema, removeCandidateTagSchema } from "@/lib/validation/schemas/recruitment";
import { TagService } from "@/lib/recruitment/tags";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentTagActionState = ActionState & {
  tag?: { id: string; name: string; color: string | null };
};

function revalidateCandidateSurfaces(candidateId: string) {
  revalidatePath(`/admin/recruitment/candidates/${candidateId}`);
  revalidatePath("/admin/recruitment/pipeline");
}

export async function addCandidateTagAction(
  _prev: RecruitmentTagActionState,
  input: unknown
): Promise<RecruitmentTagActionState> {
  try {
    const parsed = safeParseWithSchema(addCandidateTagSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const tag = await TagService.addCandidateTag(session, parsed.data);

    revalidateCandidateSurfaces(parsed.data.candidateId);
    return { success: "Tag added.", tag };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function removeCandidateTagAction(
  _prev: RecruitmentTagActionState,
  input: unknown
): Promise<RecruitmentTagActionState> {
  try {
    const parsed = safeParseWithSchema(removeCandidateTagSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    await TagService.removeCandidateTag(session, parsed.data);

    revalidateCandidateSurfaces(parsed.data.candidateId);
    return { success: "Tag removed." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
