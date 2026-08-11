import path from "node:path";
import { getEnv } from "@/lib/config/env";
import { createLocalStorageAdapter } from "@/lib/recruitment/storage/local-storage-adapter";
import { createS3StorageAdapter } from "@/lib/recruitment/storage/s3-storage-adapter";
import type { StorageAdapter } from "@/lib/recruitment/storage/types";

let cached: StorageAdapter | null = null;

export function getRecruitmentStorageRoot(): string {
  return (
    getEnv("RECRUITMENT_STORAGE_ROOT") ??
    path.join(process.cwd(), "storage", "recruitment")
  );
}

function createConfiguredStorage(): StorageAdapter {
  const driver = (getEnv("RECRUITMENT_STORAGE_DRIVER") ?? "local").toLowerCase();

  if (driver === "s3") {
    const bucket = getEnv("RECRUITMENT_S3_BUCKET");
    const region = getEnv("RECRUITMENT_S3_REGION") ?? getEnv("AWS_REGION") ?? "ap-southeast-1";
    if (!bucket) {
      throw new Error(
        "RECRUITMENT_S3_BUCKET is required when RECRUITMENT_STORAGE_DRIVER=s3."
      );
    }
    return createS3StorageAdapter({
      bucket,
      region,
      prefix: getEnv("RECRUITMENT_S3_PREFIX") ?? "recruitment",
      endpoint: getEnv("RECRUITMENT_S3_ENDPOINT"),
      forcePathStyle: getEnv("RECRUITMENT_S3_FORCE_PATH_STYLE") === "true",
    });
  }

  return createLocalStorageAdapter(getRecruitmentStorageRoot());
}

/** Process-singleton storage adapter (local FS or S3). */
export function getRecruitmentStorage(): StorageAdapter {
  if (!cached) {
    cached = createConfiguredStorage();
  }
  return cached;
}

/** Test helper — replace singleton. */
export function setRecruitmentStorageForTests(adapter: StorageAdapter | null): void {
  cached = adapter;
}
