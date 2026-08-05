"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession, getSessionOrThrow } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  createOfferSchema,
  updateOfferSchema,
  offerIdSchema,
  sendOfferSchema,
  acceptOfferSchema,
  declineOfferSchema,
  withdrawOfferSchema,
  createOfferRevisionSchema,
} from "@/lib/validation/schemas/recruitment";
import { createOfferService } from "@/lib/recruitment/services/offer-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentOfferActionState = ActionState & {
  offerId?: string;
};

function revalidateOfferList() {
  revalidatePath("/admin/recruitment/offers");
}

function revalidateOfferDetail(id: string) {
  revalidatePath(`/admin/recruitment/offers/${id}`);
}

function revalidateApplicationDetail(applicationId: string) {
  revalidatePath(`/admin/recruitment/applications/${applicationId}`);
}

function revalidateRecruitmentDashboard() {
  revalidatePath("/admin/recruitment");
}

export async function createOfferAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(createOfferSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    const { id } = await service.createOffer(session, parsed.data);

    revalidateOfferList();
    revalidateOfferDetail(id);
    revalidateApplicationDetail(parsed.data.applicationId);
    revalidateRecruitmentDashboard();

    return { success: "Offer draft created successfully.", offerId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function updateOfferAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(updateOfferSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.updateDraft(session, parsed.data);

    revalidateOfferList();
    revalidateOfferDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    return { success: "Offer draft updated successfully.", offerId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function sendOfferAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(sendOfferSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.sendOffer(session, parsed.data);

    revalidateOfferList();
    revalidateOfferDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    return { success: "Offer sent successfully.", offerId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function acceptOfferAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(acceptOfferSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.acceptOffer(session, parsed.data);

    revalidateOfferList();
    revalidateOfferDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    return { success: "Offer accepted successfully.", offerId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function declineOfferAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(declineOfferSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.declineOffer(session, parsed.data);

    revalidateOfferList();
    revalidateOfferDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    return { success: "Offer declined successfully.", offerId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function withdrawOfferAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(withdrawOfferSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.withdrawOffer(session, parsed.data);

    revalidateOfferList();
    revalidateOfferDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    return { success: "Offer withdrawn successfully.", offerId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function expireOfferAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(offerIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.expireOffer(session, parsed.data.id);

    revalidateOfferList();
    revalidateOfferDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    return { success: "Offer expired successfully.", offerId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function duplicateOfferAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(offerIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    const { id } = await service.duplicateOffer(session, parsed.data.id);

    revalidateOfferList();
    revalidateOfferDetail(id);
    revalidateRecruitmentDashboard();

    return { success: "Offer duplicated successfully.", offerId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function createOfferRevisionAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(createOfferRevisionSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.createRevision(session, parsed.data);

    revalidateOfferList();
    revalidateOfferDetail(parsed.data.id);
    revalidateRecruitmentDashboard();

    return { success: "Offer revision created successfully.", offerId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
