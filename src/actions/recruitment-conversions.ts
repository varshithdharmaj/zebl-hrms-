"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { convertEmployeeSchema } from "@/lib/validation/schemas/recruitment";
import { createEmployeeConversionService } from "@/lib/recruitment/services/employee-conversion-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentConversionActionState = ActionState & {
  employeeId?: number;
};

function revalidateAll(employeeId?: number) {
  revalidatePath("/admin/recruitment/conversions");
  revalidatePath("/admin/recruitment/offers");
  revalidatePath("/admin/recruitment/candidates");
  revalidatePath("/admin/recruitment/applications");
  revalidatePath("/admin/recruitment/pipeline");
  revalidatePath("/admin/recruitment");
  revalidatePath("/admin/employees");
  if (employeeId) {
    revalidatePath(`/admin/employees/${employeeId}`);
  }
}

export async function convertEmployeeAction(
  _prev: RecruitmentConversionActionState,
  input: unknown
): Promise<RecruitmentConversionActionState> {
  try {
    const parsed = safeParseWithSchema(convertEmployeeSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createEmployeeConversionService();
    const { employeeId } = await service.convertEmployee(session, parsed.data);

    revalidateAll(employeeId);

    return {
      success: "Candidate converted to employee successfully.",
      employeeId,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function previewConversionAction(
  offerId: string
): Promise<{ error?: string } | Awaited<ReturnType<ReturnType<typeof createEmployeeConversionService>["previewConversion"]>>> {
  try {
    const session = await requireHROrSuperAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }
    const service = createEmployeeConversionService();
    return await service.previewConversion(session, offerId);
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
