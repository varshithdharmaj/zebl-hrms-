"use server";

import { revalidatePath } from "next/cache";
import type { ActionState, BulkActionState } from "@/actions/types";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  createApplicationSchema,
  updateApplicationSchema,
  applicationIdSchema,
  moveStageSchema,
  rejectApplicationSchema,
  withdrawApplicationSchema,
  updateApplicationAssessmentSchema,
  loadPipelineColumnSchema,
  bulkMoveApplicationsStageSchema,
  bulkAssignRecruiterSchema,
} from "@/lib/validation/schemas/recruitment";
import { createApplicationService } from "@/lib/recruitment/services/application-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { listApplicationsCached } from "@/lib/recruitment/application";
import { sanitizeApplicationsForClient } from "@/lib/recruitment/application/sanitize";
import { PIPELINE_COLUMN_PAGE_SIZE } from "@/lib/recruitment/shared/pagination";
import type { ApplicationDetail } from "@/lib/recruitment/repositories/application-repository";

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

function normalizeActionInput(input: unknown): unknown {
  if (input instanceof FormData) {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of input.entries()) {
      if (typeof value !== "string") continue;
      obj[key] = value === "" ? undefined : value;
    }
    return obj;
  }
  return input;
}

export async function createApplicationAction(
  _prev: RecruitmentApplicationActionState,
  input: unknown
): Promise<RecruitmentApplicationActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(createApplicationSchema, normalizeActionInput(input));
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireRecruitmentAdminSession();

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
    const parsed = safeParseWithSchema(updateApplicationSchema, normalizeActionInput(input));
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireRecruitmentAdminSession();

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
    const session = await requireRecruitmentAdminSession();

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
    const session = await requireRecruitmentAdminSession();

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
    const session = await requireRecruitmentAdminSession();

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
    const session = await requireRecruitmentAdminSession();

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

/** @deprecated Manual hire removed — conversion owns hired state. */
export async function hireCandidateAction(
  _prev: RecruitmentApplicationActionState,
  _input: unknown
): Promise<RecruitmentApplicationActionState> {
  return {
    error:
      "Hiring is only allowed through Employee Conversion after an offer is accepted.",
  };
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
    const session = await requireRecruitmentAdminSession();

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
    const session = await requireRecruitmentAdminSession();

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

    const session = await requireRecruitmentAdminSession();

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

export type LoadPipelineColumnResult = {
  items: ApplicationDetail[];
  total: number;
  error?: string;
};

/**
 * Fetches the next page of applications for a single job+stage column on the
 * job-scoped pipeline board — the per-column "Load more" companion to the
 * board's initial per-stage fetch in pipeline/page.tsx. Read-only: goes
 * through the same scoped, permission-checked listApplications path as the
 * rest of the pipeline list/board, just called directly instead of via a
 * form-bound ActionState.
 */
export async function loadPipelineColumnAction(
  input: unknown
): Promise<LoadPipelineColumnResult> {
  try {
    const parsed = safeParseWithSchema(loadPipelineColumnSchema, input);
    if (!parsed.ok) return { items: [], total: 0, error: parsed.error };

    const session = await requireRecruitmentAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { items: [], total: 0, error: "Recruitment module is disabled." };
    }

    const result = await listApplicationsCached(
      session,
      { jobOpeningId: parsed.data.jobOpeningId, currentStage: parsed.data.stage },
      { page: parsed.data.page, pageSize: PIPELINE_COLUMN_PAGE_SIZE },
      { field: "createdAt", direction: "desc" }
    );

    return { items: sanitizeApplicationsForClient(result.items), total: result.total };
  } catch (error) {
    const state = mapUnknownToActionState(error);
    return { items: [], total: 0, error: state.error };
  }
}

export async function bulkMoveApplicationsStageAction(
  _prev: BulkActionState,
  input: unknown
): Promise<BulkActionState> {
  try {
    const parsed = safeParseWithSchema(bulkMoveApplicationsStageSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createApplicationService();
    const { processed } = await service.moveApplicationsStageBulk(session, parsed.data);

    revalidatePath("/admin/recruitment/pipeline");
    revalidateApplicationList();

    return { success: `Moved ${processed} candidate(s).`, processed, failed: 0 };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function bulkAssignRecruiterAction(
  _prev: BulkActionState,
  input: unknown
): Promise<BulkActionState> {
  try {
    const parsed = safeParseWithSchema(bulkAssignRecruiterSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createApplicationService();
    const { processed } = await service.assignRecruiterBulk(session, parsed.data);

    revalidatePath("/admin/recruitment/pipeline");
    revalidateApplicationList();

    return { success: `Assigned recruiter for ${processed} candidate(s).`, processed, failed: 0 };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
