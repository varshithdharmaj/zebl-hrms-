"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  createApplicationSchema,
  updateApplicationSchema,
  applicationIdSchema,
  moveStageSchema,
  rejectApplicationSchema,
  withdrawApplicationSchema,
  updateApplicationAssessmentSchema,
} from "@/lib/validation/schemas/recruitment";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentApplicationActionState = ActionState & {
  applicationId?: string;
};

function revalidateApplicationList() {
  revalidatePath("/admin/recruitment/applications");
}

function revalidateApplicationDetail(id: string) {
  revalidatePath(`/admin/recruitment/applications/${id}`);
}

function revalidateCandidateDetail(candidateId: string) {
  revalidatePath(`/admin/recruitment/candidates/${candidateId}`);
}

function revalidateJobDetail(jobOpeningId: string) {
  revalidatePath(`/admin/recruitment/jobs/${jobOpeningId}`);
}

function revalidateRecruitmentDashboard() {
  revalidatePath("/admin/recruitment");
}

export async function createApplicationAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(createApplicationSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createApplicationService();
    const { id } = await service.createApplication(session, parsed.data);

    // 5. Cache Invalidation
    revalidateApplicationList();
    revalidateApplicationDetail(id);
    revalidateCandidateDetail(parsed.data.candidateId);
    revalidateJobDetail(parsed.data.jobOpeningId);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Application created successfully.", applicationId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function updateApplicationAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(updateApplicationSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createApplicationService();
    await service.updateApplication(session, parsed.data);

    // 5. Cache Invalidation
    revalidateApplicationList();
    revalidateApplicationDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Application updated successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function moveApplicationStageAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(moveStageSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createApplicationService();
    await service.moveToStage(session, parsed.data);

    // 5. Cache Invalidation
    revalidateApplicationList();
    revalidateApplicationDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Application stage moved successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function rejectApplicationAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(rejectApplicationSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createApplicationService();
    await service.rejectApplication(session, parsed.data);

    // 5. Cache Invalidation
    revalidateApplicationList();
    revalidateApplicationDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Application rejected successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function withdrawApplicationAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(withdrawApplicationSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createApplicationService();
    await service.withdrawApplication(session, parsed.data);

    // 5. Cache Invalidation
    revalidateApplicationList();
    revalidateApplicationDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Application withdrawn successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function reopenApplicationAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(applicationIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createApplicationService();
    await service.reopenApplication(session, parsed.data.id);

    // 5. Cache Invalidation
    revalidateApplicationList();
    revalidateApplicationDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Application reopened successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function hireCandidateAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(applicationIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createApplicationService();
    await service.hireCandidate(session, parsed.data.id);

    // 5. Cache Invalidation
    revalidateApplicationList();
    revalidateApplicationDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Candidate hired successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function archiveApplicationAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(applicationIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createApplicationService();
    await service.archiveApplication(session, parsed.data.id);

    // 5. Cache Invalidation
    revalidateApplicationList();
    revalidateApplicationDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Application archived successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function restoreApplicationAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(applicationIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createApplicationService();
    await service.restoreApplication(session, parsed.data.id);

    // 5. Cache Invalidation
    revalidateApplicationList();
    revalidateApplicationDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Application restored successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function updateApplicationAssessmentAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    const payload =
      input instanceof FormData
        ? {
            applicationId: String(input.get("applicationId") ?? ""),
            assessment: String(input.get("assessment") ?? ""),
          }
        : input;

    const parsed = safeParseWithSchema(updateApplicationAssessmentSchema, payload);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createApplicationService();
    const updated = await service.updateApplicationAssessment(session, parsed.data);

    revalidateApplicationList();
    revalidateApplicationDetail(parsed.data.applicationId);
    revalidatePath("/admin/recruitment/pipeline");
    if (updated?.candidateId) {
      revalidateCandidateDetail(String(updated.candidateId));
    }

    return {
      success:
        parsed.data.assessment == null
          ? "Assessment cleared."
          : "Assessment saved.",
      applicationId: parsed.data.applicationId,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
