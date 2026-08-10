"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import {
  requireHROrSuperAdminSession,
  getSessionOrThrow,
} from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  createCandidateSchema,
  updateCandidateSchema,
  candidateIdSchema,
  mergeCandidateSchema,
  candidateListFiltersSchema,
  candidateSearchSchema,
  addCandidateNoteSchema,
} from "@/lib/validation/schemas/recruitment";
import { createCandidateService } from "@/lib/recruitment/services/candidate-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentCandidateActionState = ActionState & {
  candidateId?: string;
  duplicateCandidateId?: string;
};

function revalidateCandidateList() {
  revalidatePath("/admin/recruitment/candidates");
}

function revalidateCandidateDetail(candidateId: string) {
  revalidatePath(`/admin/recruitment/candidates/${candidateId}`);
  revalidatePath(`/admin/recruitment/candidates/${candidateId}/edit`);
}

function revalidateRecruitmentDashboard() {
  revalidatePath("/admin/recruitment");
}

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (value == null) return undefined;
  return String(value);
}

function formNumber(formData: FormData, key: string): number | undefined {
  const value = formData.get(key);
  if (value == null || value === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function getPayload(input: unknown) {
  if (input instanceof FormData) {
    return {
      id: formString(input, "id"),
      fullName: formString(input, "fullName"),
      firstName: formString(input, "firstName"),
      lastName: formString(input, "lastName"),
      preferredName: formString(input, "preferredName"),
      email: formString(input, "email"),
      phone: formString(input, "phone"),
      alternatePhone: formString(input, "alternatePhone"),
      dateOfBirth: formString(input, "dateOfBirth"),
      location: formString(input, "location"),
      preferredLocation: formString(input, "preferredLocation"),
      nationality: formString(input, "nationality"),
      currentCompany: formString(input, "currentCompany"),
      currentTitle: formString(input, "currentTitle"),
      linkedinUrl: formString(input, "linkedinUrl"),
      githubUrl: formString(input, "githubUrl"),
      portfolioUrl: formString(input, "portfolioUrl"),
      professionalSummary: formString(input, "professionalSummary"),
      headline: formString(input, "headline"),
      totalExperienceYears: formString(input, "totalExperienceYears"),
      preferredWorkMode: formString(input, "preferredWorkMode"),
      willingToRelocate: formString(input, "willingToRelocate"),
      source: formString(input, "source"),
      status: formString(input, "status"),
      doNotHireReason: formString(input, "doNotHireReason"),
      currentCtc: formString(input, "currentCtc"),
      expectedCtc: formString(input, "expectedCtc"),
      currency: formString(input, "currency"),
      noticePeriodDays: formNumber(input, "noticePeriodDays"),
      earliestJoinDate: formString(input, "earliestJoinDate"),
      availabilityNotes: formString(input, "availabilityNotes"),
      timezone: formString(input, "timezone"),
      primaryRecruiterUserId: formString(input, "primaryRecruiterUserId"),
      referredByEmployeeId: formNumber(input, "referredByEmployeeId"),
    };
  }
  return input;
}

export async function createCandidateAction(
  _prev: RecruitmentCandidateActionState,
  input: unknown
): Promise<RecruitmentCandidateActionState> {
  try {
    // 1. Validation
    const payload = getPayload(input);
    const parsed = safeParseWithSchema(createCandidateSchema, payload);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createCandidateService();
    const { id } = await service.createCandidate(session, parsed.data);

    // 5. Cache Invalidation
    revalidateCandidateList();
    revalidateCandidateDetail(id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Candidate profile created.", candidateId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function updateCandidateAction(
  _prev: RecruitmentCandidateActionState,
  input: unknown
): Promise<RecruitmentCandidateActionState> {
  try {
    // 1. Validation
    const payload = getPayload(input);
    const parsed = safeParseWithSchema(updateCandidateSchema, payload);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createCandidateService();
    await service.updateCandidate(session, parsed.data.id, parsed.data);

    // 5. Cache Invalidation
    revalidateCandidateDetail(parsed.data.id);
    revalidateCandidateList();

    // 6. Return ActionState
    return { success: "Candidate profile updated.", candidateId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function archiveCandidateAction(
  _prev: RecruitmentCandidateActionState,
  input: unknown
): Promise<RecruitmentCandidateActionState> {
  try {
    // 1. Validation
    const payload = getPayload(input);
    const parsed = safeParseWithSchema(candidateIdSchema, payload);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createCandidateService();
    await service.archiveCandidate(session, parsed.data.id);

    // 5. Cache Invalidation
    revalidateCandidateList();
    revalidateCandidateDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Candidate profile archived.", candidateId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function restoreCandidateAction(
  _prev: RecruitmentCandidateActionState,
  input: unknown
): Promise<RecruitmentCandidateActionState> {
  try {
    // 1. Validation
    const payload = getPayload(input);
    const parsed = safeParseWithSchema(candidateIdSchema, payload);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createCandidateService();
    await service.restoreCandidate(session, parsed.data.id);

    // 5. Cache Invalidation
    revalidateCandidateList();
    revalidateCandidateDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Candidate profile restored.", candidateId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function mergeCandidateAction(
  _prev: RecruitmentCandidateActionState,
  input: unknown
): Promise<RecruitmentCandidateActionState> {
  try {
    // 1. Validation — FormData fields are strings; mergeCandidateSchema validates shape.
    const payload =
      input instanceof FormData
        ? {
            sourceId: formString(input, "sourceId"),
            targetId: formString(input, "targetId"),
          }
        : input;
    const parsed = safeParseWithSchema(mergeCandidateSchema, payload);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await requireHROrSuperAdminSession();

    // 3. Feature Flag Check
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    // 4. Service Call
    const service = createCandidateService();
    await service.mergeCandidate(session, parsed.data.sourceId, parsed.data.targetId);

    // 5. Cache Invalidation
    revalidateCandidateList();
    revalidateCandidateDetail(parsed.data.sourceId);
    revalidateCandidateDetail(parsed.data.targetId);
    revalidateRecruitmentDashboard();

    // 6. Return ActionState
    return { success: "Candidate records merged.", candidateId: parsed.data.targetId };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function getCandidateAction(candidateId: string) {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(candidateIdSchema, { id: candidateId });
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await getSessionOrThrow();

    // 3. Service Call
    const service = createCandidateService();
    const candidate = await service.getCandidate(session, parsed.data.id);

    // 4. Return ActionState
    return { success: "OK", candidate };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function listCandidatesAction(raw: unknown) {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(candidateListFiltersSchema, raw);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await getSessionOrThrow();

    // 3. Service Call
    const service = createCandidateService();
    const result = await service.listCandidates(session, {
      filters: {
        q: parsed.data.q,
        status: parsed.data.status,
        source: parsed.data.source,
        includeArchived: parsed.data.includeArchived,
        createdBy: parsed.data.createdBy,
        primaryRecruiter: parsed.data.primaryRecruiter,
      },
      pagination: { page: parsed.data.page, pageSize: parsed.data.pageSize },
      sort: { field: parsed.data.sort, direction: parsed.data.direction },
    });

    // 4. Return ActionState
    return { success: "OK", result };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function searchCandidatesAction(raw: unknown) {
  try {
    // 1. Validation
    const parsed = safeParseWithSchema(candidateSearchSchema, raw);
    if (!parsed.ok) return { error: parsed.error };

    // 2. Permission Check
    const session = await getSessionOrThrow();

    // 3. Service Call
    const service = createCandidateService();
    const result = await service.searchCandidates(session, {
      query: parsed.data.query,
      pagination: { page: parsed.data.page, pageSize: parsed.data.pageSize },
    });

    // 4. Return ActionState
    return { success: "OK", result };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function addCandidateNoteAction(
  _prev: RecruitmentCandidateActionState,
  input: unknown
): Promise<RecruitmentCandidateActionState & { noteId?: string }> {
  try {
    const payload =
      input instanceof FormData
        ? {
            candidateId: formString(input, "candidateId"),
            body: formString(input, "body"),
            visibility: formString(input, "visibility"),
          }
        : input;

    const parsed = safeParseWithSchema(addCandidateNoteSchema, payload);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateService();
    const note = await service.addCandidateNote(session, parsed.data);

    revalidateCandidateDetail(parsed.data.candidateId);
    revalidatePath("/admin/recruitment/pipeline");

    return {
      success: "Note added.",
      candidateId: parsed.data.candidateId,
      noteId: note.id,
    };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
