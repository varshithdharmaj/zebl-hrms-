import path from "node:path";
import { getEnv } from "@/lib/config/env";
import { createConfiguredStorage } from "@/lib/recruitment/storage/configured-storage";
import type { StorageAdapter } from "@/lib/recruitment/storage/types";

let cached: StorageAdapter | null = null;

export function getUserPhotoStorageRoot(): string {
  return getEnv("USER_PHOTO_STORAGE_ROOT") ?? path.join(process.cwd(), "storage", "user-photos");
}

/** Process-singleton storage adapter (local FS or S3). */
export function getUserPhotoStorage(): StorageAdapter {
  if (!cached) {
    cached = createConfiguredStorage({
      envPrefix: "USER_PHOTO",
      localRoot: getUserPhotoStorageRoot(),
      defaultS3Prefix: "user-photos",
    });
  }
  return cached;
}

/** Test helper — replace singleton. */
export function setUserPhotoStorageForTests(adapter: StorageAdapter | null): void {
  cached = adapter;
}
