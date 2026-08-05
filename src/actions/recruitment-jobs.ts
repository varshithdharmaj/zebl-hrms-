"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  archiveJobOpeningSchema,
  changeJobStatusSchema,
  closeJobOpeningSchema,
  createJobOpeningSchema,
  hiringTeamMemberIdSchema,
  hiringTeamMemberSchema,
  jobOpeningIdSchema,
  reopenJobOpeningSchema,
  updateJobOpeningSchema,
} from "@/lib/validation/schemas/recruitment/jobs";
import { JobOpeningService } from "@/lib/recruitment/job/job-opening-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { JobOpeningStatus } from "@/generated/prisma/enums";

export type RecruitmentJobActionState = ActionState & {
  jobId?: string;
};

function revalidateJobs(jobId?: string) {
  revalidatePath("/admin/recruitment");
  revalidatePath("/admin/recruitment/jobs");
  if (jobId) {
    revalidatePath(`/admin/recruitment/jobs/${jobId}`);
    revalidatePath(`/admin/recruitment/jobs/${jobId}/edit`);
  }
}

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (value == null) return undefined;
  return String(value);
}

function formBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "true" || value === "on" || value === "1";
}

function parseTeamLeadIds(formData: FormData): number[] {
  const all = formData.getAll("teamLeadEmployeeIds");
  return all
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function createPayloadFromForm(formData: FormData) {
  return {
    title: formString(formData, "title"),
    code: formString(formData, "code"),
    department: formString(formData, "department"),
    location: formString(formData, "location"),
    workMode: formString(formData, "workMode") || null,
    employmentType: formString(formData, "employmentType"),
    description: formString(formData, "description"),
    requirements: formString(formData, "requirements"),
    skills: formString(formData, "skills"),
    openingsCount: formString(formData, "openingsCount"),
    headcountApproved: formBoolean(formData, "headcountApproved"),
    headcountRequestedByEmployeeId: formString(formData, "headcountRequestedByEmployeeId") || null,
    headcountUrgency: formString(formData, "headcountUrgency") || null,
    compensationCurrency: formString(formData, "compensationCurrency"),
    compensationMin: formString(formData, "compensationMin"),
    compensationMax: formString(formData, "compensationMax"),
    targetStartDate: formString(formData, "targetStartDate"),
    pipelineTemplateId: formString(formData, "pipelineTemplateId"),
    ownerRecruiterUserId: formString(formData, "ownerRecruiterUserId"),
    hiringManagerEmployeeId: formString(formData, "hiringManagerEmployeeId") || null,
    teamLeadEmployeeIds: parseTeamLeadIds(formData),
    recruiterEmployeeId: formString(formData, "recruiterEmployeeId") || null,
    notes: formString(formData, "notes"),
    publish: formBoolean(formData, "publish"),
  };
}

export async function createJobOpeningAction(
  _prev: RecruitmentJobActionState,
  formData: FormData
): Promise<RecruitmentJobActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(createJobOpeningSchema, createPayloadFromForm(formData));
    if (!parsed.ok) return { error: parsed.error };

    const { jobId } = await JobOpeningService.create(session, parsed.data);
    revalidateJobs(jobId);
    redirect(`/admin/recruitment/jobs/${jobId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return mapUnknownToActionState(error);
  }
}

export async function updateJobOpeningAction(
  _prev: RecruitmentJobActionState,
  formData: FormData
): Promise<RecruitmentJobActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const payload = {
      ...createPayloadFromForm(formData),
      id: formString(formData, "id"),
    };
    const parsed = safeParseWithSchema(updateJobOpeningSchema, payload);
    if (!parsed.ok) return { error: parsed.error };

    await JobOpeningService.update(session, parsed.data);
    revalidateJobs(parsed.data.id);
    return { success: "Job opening updated.", jobId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function archiveJobOpeningAction(
  _prev: RecruitmentJobActionState,
  formData: FormData
): Promise<RecruitmentJobActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(archiveJobOpeningSchema, {
      id: formString(formData, "id"),
    });
    if (!parsed.ok) return { error: parsed.error };
    await JobOpeningService.archive(session, parsed.data.id);
    revalidateJobs(parsed.data.id);
    return { success: "Job opening archived.", jobId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function closeJobOpeningAction(
  _prev: RecruitmentJobActionState,
  formData: FormData
): Promise<RecruitmentJobActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(closeJobOpeningSchema, {
      id: formString(formData, "id"),
      reason: formString(formData, "reason"),
    });
    if (!parsed.ok) return { error: parsed.error };
    await JobOpeningService.close(session, parsed.data.id, parsed.data.reason);
    revalidateJobs(parsed.data.id);
    return { success: "Job opening closed.", jobId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function reopenJobOpeningAction(
  _prev: RecruitmentJobActionState,
  formData: FormData
): Promise<RecruitmentJobActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(reopenJobOpeningSchema, {
      id: formString(formData, "id"),
      toStatus: formString(formData, "toStatus") ?? JobOpeningStatus.open,
      reason: formString(formData, "reason"),
    });
    if (!parsed.ok) return { error: parsed.error };
    await JobOpeningService.reopen(session, parsed.data.id, parsed.data.toStatus);
    revalidateJobs(parsed.data.id);
    return { success: "Job opening reopened.", jobId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function changeJobOpeningStatusAction(
  _prev: RecruitmentJobActionState,
  formData: FormData
): Promise<RecruitmentJobActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(changeJobStatusSchema, {
      id: formString(formData, "id"),
      toStatus: formString(formData, "toStatus"),
      reason: formString(formData, "reason") ?? null,
    });
    if (!parsed.ok) return { error: parsed.error };
    await JobOpeningService.changeStatus(
      session,
      parsed.data.id,
      parsed.data.toStatus,
      parsed.data.reason
    );
    revalidateJobs(parsed.data.id);
    return { success: "Job status updated.", jobId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function getJobOpeningAction(jobId: string) {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(jobOpeningIdSchema, { id: jobId });
    if (!parsed.ok) return { error: parsed.error };
    const job = await JobOpeningService.get(session, parsed.data.id);
    return { success: "OK", job };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function listJobOpeningsAction(raw: unknown) {
  try {
    const session = await requireHROrSuperAdminSession();
    const { jobOpeningListFiltersSchema } = await import(
      "@/lib/validation/schemas/recruitment/jobs"
    );
    const parsed = safeParseWithSchema(jobOpeningListFiltersSchema, raw);
    if (!parsed.ok) return { error: parsed.error };
    const result = await JobOpeningService.list(session, {
      filters: {
        q: parsed.data.q,
        status: parsed.data.status,
        department: parsed.data.department,
        ownerRecruiterUserId: parsed.data.ownerRecruiterUserId,
        includeArchived: parsed.data.includeArchived,
      },
      pagination: { page: parsed.data.page, pageSize: parsed.data.pageSize },
      sort: { field: parsed.data.sort, direction: parsed.data.direction },
    });
    return { success: "OK", result };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function addHiringTeamMemberAction(
  _prev: RecruitmentJobActionState,
  formData: FormData
): Promise<RecruitmentJobActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(hiringTeamMemberSchema, {
      jobOpeningId: formString(formData, "jobOpeningId"),
      employeeId: formString(formData, "employeeId"),
      role: formString(formData, "role"),
    });
    if (!parsed.ok) return { error: parsed.error };
    await JobOpeningService.addHiringTeamMember(
      session,
      parsed.data.jobOpeningId,
      parsed.data.employeeId,
      parsed.data.role
    );
    revalidateJobs(parsed.data.jobOpeningId);
    return { success: "Hiring team member added.", jobId: parsed.data.jobOpeningId };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function removeHiringTeamMemberAction(
  _prev: RecruitmentJobActionState,
  formData: FormData
): Promise<RecruitmentJobActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(hiringTeamMemberIdSchema, {
      memberId: formString(formData, "memberId"),
      jobOpeningId: formString(formData, "jobOpeningId"),
    });
    if (!parsed.ok) return { error: parsed.error };
    await JobOpeningService.removeHiringTeamMember(
      session,
      parsed.data.jobOpeningId,
      parsed.data.memberId
    );
    revalidateJobs(parsed.data.jobOpeningId);
    return { success: "Hiring team member removed.", jobId: parsed.data.jobOpeningId };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
