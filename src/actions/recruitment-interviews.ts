"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession, getSessionOrThrow } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  createInterviewSchema,
  updateInterviewSchema,
  interviewIdSchema,
  submitFeedbackSchema,
} from "@/lib/validation/schemas/recruitment";
import { createInterviewService } from "@/lib/recruitment/services/interview-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentInterviewActionState = ActionState & {
  interviewId?: string;
};

function revalidateInterviewList() {
  revalidatePath("/admin/recruitment/interviews");
}

function revalidateInterviewDetail(id: string) {
  revalidatePath(`/admin/recruitment/interviews/${id}`);
}

function revalidateApplicationDetail(applicationId: string) {
  revalidatePath(`/admin/recruitment/applications/${applicationId}`);
}

function revalidateRecruitmentDashboard() {
  revalidatePath("/admin/recruitment");
}

export async function createInterviewAction(
  _prev: RecruitmentInterviewActionState,
  input: unknown
): Promise<RecruitmentInterviewActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(createInterviewSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createInterviewService();
    const { id } = await service.createInterview(session, parsed.data);

    // 5. Cache Invalidation
    revalidateInterviewList();
    revalidateInterviewDetail(id);
    revalidateApplicationDetail(parsed.data.applicationId);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Interview scheduled successfully.", interviewId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function updateInterviewAction(
  _prev: RecruitmentInterviewActionState,
  input: unknown
): Promise<RecruitmentInterviewActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(updateInterviewSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createInterviewService();
    const { applicationId } = await service.updateInterview(session, parsed.data);

    // 5. Cache Invalidation
    revalidateInterviewList();
    revalidateInterviewDetail(parsed.data.id);
    revalidateApplicationDetail(applicationId);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Interview updated successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function cancelInterviewAction(
  _prev: RecruitmentInterviewActionState,
  input: unknown
): Promise<RecruitmentInterviewActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(interviewIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createInterviewService();
    const { applicationId } = await service.cancelInterview(session, parsed.data.id);

    // 5. Cache Invalidation
    revalidateInterviewList();
    revalidateInterviewDetail(parsed.data.id);
    revalidateApplicationDetail(applicationId);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Interview cancelled successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function completeInterviewAction(
  _prev: RecruitmentInterviewActionState,
  input: unknown
): Promise<RecruitmentInterviewActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(interviewIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createInterviewService();
    await service.completeInterview(session, parsed.data.id);

    // 5. Cache Invalidation
    revalidateInterviewList();
    revalidateInterviewDetail(parsed.data.id);
    if ((input as any).applicationId) {
      revalidateApplicationDetail((input as any).applicationId);
    }
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Interview marked as completed." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function submitInterviewFeedbackAction(
  _prev: RecruitmentInterviewActionState,
  input: unknown
): Promise<RecruitmentInterviewActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(submitFeedbackSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check (Interviewers can also submit feedback, so we fetch session first)
    const session = await getSessionOrThrow();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createInterviewService();
    await service.submitFeedback(session, parsed.data);

    // 5. Cache Invalidation
    revalidateInterviewDetail(parsed.data.interviewId);
    if ((input as any).applicationId) {
      revalidateApplicationDetail((input as any).applicationId);
    }

    // 6. Return ActionState
    return { success: "Feedback submitted successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function archiveInterviewAction(
  _prev: RecruitmentInterviewActionState,
  input: unknown
): Promise<RecruitmentInterviewActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(interviewIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createInterviewService();
    await service.archiveInterview(session, parsed.data.id);

    // 5. Cache Invalidation
    revalidateInterviewList();
    revalidateInterviewDetail(parsed.data.id);

    // 6. Return ActionState
    return { success: "Interview archived successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function restoreInterviewAction(
  _prev: RecruitmentInterviewActionState,
  input: unknown
): Promise<RecruitmentInterviewActionState> {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(interviewIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createInterviewService();
    await service.restoreInterview(session, parsed.data.id);

    // 5. Cache Invalidation
    revalidateInterviewList();
    revalidateInterviewDetail(parsed.data.id);

    // 6. Return ActionState
    return { success: "Interview restored successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
