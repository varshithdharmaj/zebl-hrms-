"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  renameDocumentSchema,
  documentIdSchema,
  replaceResumeSchema,
} from "@/lib/validation/schemas/recruitment";
import {
  checksumBuffer,
  createCandidateDocumentService,
} from "@/lib/recruitment/services/candidate-document-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { RecruitmentDocumentType } from "@/generated/prisma/enums";

export type RecruitmentDocumentActionState = ActionState & {
  documentId?: string;
};

function revalidateCandidateDetail(candidateId: string) {
  revalidatePath(`/admin/recruitment/candidates/${candidateId}`);
}

function readUploadFile(formData: FormData): {
  file: File;
  candidateId: string;
  documentType: RecruitmentDocumentType;
} | { error: string } {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "A non-empty file is required." };
  }

  const candidateId = String(formData.get("candidateId") ?? "").trim();
  if (!candidateId) {
    return { error: "Candidate ID is required." };
  }

  const rawType = String(formData.get("documentType") ?? RecruitmentDocumentType.resume);
  if (!Object.values(RecruitmentDocumentType).includes(rawType as RecruitmentDocumentType)) {
    return { error: "Invalid document type." };
  }

  return {
    file,
    candidateId,
    documentType: rawType as RecruitmentDocumentType,
  };
}

export async function uploadCandidateDocumentAction(
  _prev: RecruitmentDocumentActionState,
  formData: FormData
): Promise<RecruitmentDocumentActionState> {
  try {
    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const parsed = readUploadFile(formData);
    if ("error" in parsed) return { error: parsed.error };

    const buffer = Buffer.from(await parsed.file.arrayBuffer());
    const service = createCandidateDocumentService();
    const { id } = await service.uploadDocument(session, {
      candidateId: parsed.candidateId,
      documentType: parsed.documentType,
      fileName: parsed.file.name || "upload.bin",
      mimeType: parsed.file.type || "application/octet-stream",
      sizeBytes: buffer.byteLength,
      checksum: checksumBuffer(buffer),
      content: buffer,
    });

    revalidateCandidateDetail(parsed.candidateId);
    return { success: "Document uploaded successfully.", documentId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function replaceCandidateResumeAction(
  _prev: RecruitmentDocumentActionState,
  formData: FormData
): Promise<RecruitmentDocumentActionState> {
  try {
    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const meta = safeParseWithSchema(replaceResumeSchema, {
      candidateId: String(formData.get("candidateId") ?? ""),
      replaceDocumentId: String(formData.get("replaceDocumentId") ?? ""),
    });
    if (!meta.ok) return { error: meta.error };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "A non-empty file is required." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const service = createCandidateDocumentService();
    const { id } = await service.replaceResume(session, {
      candidateId: meta.data.candidateId,
      replaceDocumentId: meta.data.replaceDocumentId,
      fileName: file.name || "resume.pdf",
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.byteLength,
      checksum: checksumBuffer(buffer),
      content: buffer,
    });

    revalidateCandidateDetail(meta.data.candidateId);
    return { success: "Resume replaced successfully.", documentId: id };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function renameCandidateDocumentAction(
  _prev: RecruitmentDocumentActionState,
  input: unknown
): Promise<RecruitmentDocumentActionState> {
  try {
    const parsed = safeParseWithSchema(renameDocumentSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateDocumentService();
    await service.renameDocument(session, parsed.data);

    const candidateId =
      typeof input === "object" &&
      input &&
      "candidateId" in input &&
      typeof (input as { candidateId?: unknown }).candidateId === "string"
        ? (input as { candidateId: string }).candidateId
        : "";
    if (candidateId) revalidateCandidateDetail(candidateId);

    return { success: "Document renamed successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function deleteCandidateDocumentAction(
  _prev: RecruitmentDocumentActionState,
  input: unknown
): Promise<RecruitmentDocumentActionState> {
  try {
    const parsed = safeParseWithSchema(documentIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateDocumentService();
    await service.deleteDocument(session, parsed.data.id);

    const candidateId =
      typeof input === "object" &&
      input &&
      "candidateId" in input &&
      typeof (input as { candidateId?: unknown }).candidateId === "string"
        ? (input as { candidateId: string }).candidateId
        : "";
    if (candidateId) revalidateCandidateDetail(candidateId);

    return { success: "Document deleted successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function restoreCandidateDocumentAction(
  _prev: RecruitmentDocumentActionState,
  input: unknown
): Promise<RecruitmentDocumentActionState> {
  try {
    const parsed = safeParseWithSchema(documentIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateDocumentService();
    await service.restoreDocument(session, parsed.data.id);

    const candidateId =
      typeof input === "object" &&
      input &&
      "candidateId" in input &&
      typeof (input as { candidateId?: unknown }).candidateId === "string"
        ? (input as { candidateId: string }).candidateId
        : "";
    if (candidateId) revalidateCandidateDetail(candidateId);

    return { success: "Document restored successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function setPrimaryResumeAction(
  _prev: RecruitmentDocumentActionState,
  input: unknown
): Promise<RecruitmentDocumentActionState> {
  try {
    const parsed = safeParseWithSchema(documentIdSchema, input);
    if (!parsed.ok) return { error: parsed.error };

    const session = await requireHROrSuperAdminSession();

    if (!isRecruitmentModuleEnabled()) {
      return { error: "Recruitment module is disabled." };
    }

    const service = createCandidateDocumentService();
    await service.setPrimaryResume(session, parsed.data.id);

    const candidateId =
      typeof input === "object" &&
      input &&
      "candidateId" in input &&
      typeof (input as { candidateId?: unknown }).candidateId === "string"
        ? (input as { candidateId: string }).candidateId
        : "";
    if (candidateId) revalidateCandidateDetail(candidateId);

    return { success: "Primary resume updated successfully." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
