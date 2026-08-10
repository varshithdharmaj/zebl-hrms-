"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { submitHiringDecisionSchema } from "@/lib/validation/schemas/recruitment";
import { createHiringDecisionService } from "@/lib/recruitment/services/hiring-decision-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentDecisionActionState = ActionState & {
  decisionId?: string;
  version?: number;
};

function revalidateDecisionViews(applicationId: string) {
  revalidatePath(`/admin/recruitment/applications/${applicationId}`);
  revalidatePath("/admin/recruitment/pipeline");
  revalidatePath("/admin/recruitment/applications");
  revalidatePath("/admin/recruitment");
  revalidatePath("/admin/recruitment/offers");
  revalidatePath("/admin/recruitment/offers/new");
}

export async function submitHiringDecisionAction(
  _prev: RecruitmentDecisionActionState,
  input: unknown
): Promise<RecruitmentDecisionActionState> {
  try {
    const parsed = safeParseWithSchema(submitHiringDecisionSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createHiringDecisionService();
    const decision = await service.submit(session, parsed.data);

    revalidateDecisionViews(parsed.data.applicationId);

    return {
      success:
        decision.version > 1
          ? `Hiring decision revised (version ${decision.version}).`
          : "Hiring decision submitted.",
      decisionId: decision.id,
      version: decision.version,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
