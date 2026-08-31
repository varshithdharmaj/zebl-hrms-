"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
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
  attachOfferPdfSchema,
  generateOfferLetterSchema,
} from "@/lib/validation/schemas/recruitment";
import { createOfferService } from "@/lib/recruitment/services/offer-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export type RecruitmentOfferActionState = ActionState & {
  offerId?: string;
};

function revalidateOfferPaths(id?: string, applicationId?: string) {
  revalidatePath("/admin/recruitment/offers");
  if (id) {
    revalidatePath(`/admin/recruitment/offers/${id}`);
  }
  if (applicationId) {
    revalidatePath(`/admin/recruitment/applications/${applicationId}`);
  }
  revalidatePath("/admin/recruitment");
}

export async function createOfferAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(createOfferSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    const { id } = await service.createOffer(session, parsed.data);

    revalidateOfferPaths(id, parsed.data.applicationId);

    return { success: "Offer draft created successfully.", offerId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function updateOfferDraftAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(updateOfferSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.updateDraft(session, parsed.data);

    revalidateOfferPaths(parsed.data.id);

    return { success: "Offer draft updated successfully.", offerId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export const updateOfferAction = updateOfferDraftAction;

export async function sendOfferAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(sendOfferSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.sendOffer(session, parsed.data);

    revalidateOfferPaths(parsed.data.id);

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

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.acceptOffer(session, parsed.data);

    revalidateOfferPaths(parsed.data.id);

    return { success: "Offer accepted and employee record created.", offerId: parsed.data.id };
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

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.declineOffer(session, parsed.data);

    revalidateOfferPaths(parsed.data.id);

    return { success: "Offer marked as declined.", offerId: parsed.data.id };
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

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.withdrawOffer(session, parsed.data);

    revalidateOfferPaths(parsed.data.id);

    return { success: "Offer withdrawn successfully.", offerId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function generateOfferLetterAction(
  _prev: RecruitmentOfferActionState,
  input: unknown
): Promise<RecruitmentOfferActionState> {
  try {
    const parsed = safeParseWithSchema(generateOfferLetterSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.generateOfferLetter(session, parsed.data);

    revalidateOfferPaths(parsed.data.id);

    return { success: "Offer letter generated successfully.", offerId: parsed.data.id };
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

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.expireOffer(session, parsed.data.id);

    revalidateOfferPaths(parsed.data.id);

    return { success: "Offer marked as expired.", offerId: parsed.data.id };
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

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    const { id } = await service.duplicateOffer(session, parsed.data.id);

    revalidateOfferPaths(id);

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

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createOfferService();
    await service.createRevision(session, parsed.data);

    revalidateOfferPaths(parsed.data.id);

    return { success: "Offer revision created successfully.", offerId: parsed.data.id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function attachOfferPdfAction(
  _prev: RecruitmentOfferActionState,
  formData: FormData
): Promise<RecruitmentOfferActionState> {
  try {
    const id = String(formData.get("id") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return { error: "PDF file is required." };
    }

    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const parsed = safeParseWithSchema(attachOfferPdfSchema, {
      id,
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      sizeBytes: file.size,
    });
    if (!parsed.ok) return { error: parsed.error };

    const buffer = Buffer.from(await file.arrayBuffer());
    const service = createOfferService();
    await service.attachOfferPdf(session, {
      ...parsed.data,
      content: buffer,
    });

    revalidateOfferPaths(id);

    return { success: "Offer PDF attached successfully.", offerId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
