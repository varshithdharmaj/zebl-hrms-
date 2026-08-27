import { buildStorageKey, isSafeStorageKey } from "@/lib/recruitment/shared/storage-paths";

export function buildUserPhotoStorageKey(userId: string, fileName: string): string {
  return buildStorageKey(`users/${userId}/photo/`, fileName);
}

export function isSafeUserPhotoKey(userId: string, key: string): boolean {
  return isSafeStorageKey(`users/${userId}/photo/`, key);
}
