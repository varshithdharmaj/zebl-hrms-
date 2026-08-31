"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/types";
import { requireRecruitmentAdminSession } from "@/lib/auth-guards";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import {
  checksumBuffer,
  createCandidateDocumentService,
} from "@/lib/recruitment/services/candidate-document-service";
import { mapUnknownToActionState } from "@/lib/recruitment/shared/result";
import { RecruitmentDocumentType } from "@/generated/prisma/enums";

function revalidateCandidateDetail(candidateId: string) {
  revalidatePath(`/admin/recruitment/candidates/${candidateId}`);
}

/**
 * Soft-deletes any active photo document(s) for the candidate. Mirrors the
 * employee profile-photo flow's "delete old, save new" pattern rather than
 * using setPrimaryResume(), which is guarded to resume documents only.
 */
async function clearActivePhotos(
  service: ReturnType<typeof createCandidateDocumentService>,
  session: Awaited<ReturnType<typeof requireRecruitmentAdminSession>>,
  candidateId: string
): Promise<void> {
  const docs = await service.getCandidateDocuments(session, candidateId);
  const activePhotos = docs.filter(
    (d) => d.documentType === RecruitmentDocumentType.photo && d.deletedAt == null
  );
  for (const doc of activePhotos) {
    await service.deleteDocument(session, doc.id as string);
  }
}

export async function uploadCandidatePhotoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) return { error: "Recruitment module is disabled." };

    const candidateId = String(formData.get("candidateId") ?? "").trim();
    if (!candidateId) return { error: "Candidate ID is required." };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Please select a photo." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const service = createCandidateDocumentService();

    await clearActivePhotos(service, session, candidateId);

    await service.uploadDocument(session, {
      candidateId,
      documentType: RecruitmentDocumentType.photo,
      fileName: file.name || "photo.jpg",
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.byteLength,
      checksum: checksumBuffer(buffer),
      content: buffer,
    });

    revalidateCandidateDetail(candidateId);
    return { success: "Photo updated." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}

export async function removeCandidatePhotoAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireRecruitmentAdminSession();
    if (!isRecruitmentModuleEnabled()) return { error: "Recruitment module is disabled." };

    const candidateId = String(formData.get("candidateId") ?? "").trim();
    if (!candidateId) return { error: "Candidate ID is required." };

    const service = createCandidateDocumentService();
    await clearActivePhotos(service, session, candidateId);

    revalidateCandidateDetail(candidateId);
    return { success: "Photo removed." };
  } catch (error) {
    return mapUnknownToActionState(error);
  }
}
