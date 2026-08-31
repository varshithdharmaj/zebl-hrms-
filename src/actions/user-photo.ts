"use server";

import { revalidatePath } from "next/cache";
import { getSessionOrThrow } from "@/lib/auth-guards";
import { canEditEmployeeProfilePhoto } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { assertUserPhotoFile, UserPhotoValidationError } from "@/lib/user-photo/file-validation";
import { buildUserPhotoStorageKey } from "@/lib/user-photo/storage-paths";
import { getUserPhotoStorage } from "@/lib/user-photo/storage";

export type UserPhotoActionState = {
  error?: string;
  success?: string;
};

async function assertCanEditTargetPhoto(targetUserId: string) {
  const session = await getSessionOrThrow();

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { employeeId: true, profilePhotoStorageKey: true },
  });
  if (!target || target.employeeId == null) {
    throw new Error("This account has no employee profile to attach a photo to.");
  }

  const allowed = canEditEmployeeProfilePhoto({
    actorRole: session.role,
    actorEmployeeId: session.employeeId,
    targetEmployeeId: target.employeeId,
  });
  if (!allowed) {
    throw new Error("You don't have permission to change this photo.");
  }

  return target;
}

async function deleteOldPhotoBestEffort(storageKey: string | null) {
  if (!storageKey) return;
  try {
    await getUserPhotoStorage().delete(storageKey);
  } catch {
    // Best-effort — an orphaned blob is not worth failing the upload over.
  }
}

export async function uploadProfilePhotoAction(
  _prev: UserPhotoActionState,
  formData: FormData
): Promise<UserPhotoActionState> {
  try {
    const targetUserId = String(formData.get("userId") ?? "");
    if (!targetUserId) return { error: "Invalid user." };

    const target = await assertCanEditTargetPhoto(targetUserId);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Please select a photo." };
    }

    const content = Buffer.from(await file.arrayBuffer());
    assertUserPhotoFile(file.name || "photo", file.type || "application/octet-stream", content);

    const key = buildUserPhotoStorageKey(targetUserId, file.name || "photo");
    await getUserPhotoStorage().save(key, content, { contentType: file.type || undefined });

    await prisma.user.update({
      where: { id: targetUserId },
      data: { profilePhotoStorageKey: key, profilePhotoUrl: `/api/profile-photo/${targetUserId}` },
    });

    await deleteOldPhotoBestEffort(target.profilePhotoStorageKey);

    revalidatePath("/admin/employees");
    return { success: "Photo updated." };
  } catch (error) {
    if (error instanceof UserPhotoValidationError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Failed to upload photo." };
  }
}

export async function removeProfilePhotoAction(
  _prev: UserPhotoActionState,
  formData: FormData
): Promise<UserPhotoActionState> {
  try {
    const targetUserId = String(formData.get("userId") ?? "");
    if (!targetUserId) return { error: "Invalid user." };

    const target = await assertCanEditTargetPhoto(targetUserId);

    await prisma.user.update({
      where: { id: targetUserId },
      data: { profilePhotoStorageKey: null, profilePhotoUrl: null },
    });

    await deleteOldPhotoBestEffort(target.profilePhotoStorageKey);

    revalidatePath("/admin/employees");
    return { success: "Photo removed." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to remove photo." };
  }
}
