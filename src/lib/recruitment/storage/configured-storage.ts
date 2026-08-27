import { getEnv } from "@/lib/config/env";
import { createLocalStorageAdapter } from "@/lib/recruitment/storage/local-storage-adapter";
import { createS3StorageAdapter } from "@/lib/recruitment/storage/s3-storage-adapter";
import type { StorageAdapter } from "@/lib/recruitment/storage/types";

export type ConfiguredStorageOptions = {
  /** Shared prefix for this namespace's env vars, e.g. "USER_PHOTO" or "RECRUITMENT". */
  envPrefix: string;
  /** Local-driver root, already resolved (including any `<envPrefix>_STORAGE_ROOT` override). */
  localRoot: string;
  /** S3 key prefix used when `<envPrefix>_S3_PREFIX` is unset. */
  defaultS3Prefix: string;
};

/**
 * Local-or-S3 StorageAdapter builder driven by a `<envPrefix>_*` env var
 * family (`_STORAGE_DRIVER`, `_S3_BUCKET`, `_S3_REGION`, `_S3_PREFIX`,
 * `_S3_ENDPOINT`, `_S3_FORCE_PATH_STYLE`). Every storage namespace (user
 * photos, recruitment documents, ...) shares this one driver-selection
 * implementation instead of each re-declaring it.
 */
export function createConfiguredStorage(options: ConfiguredStorageOptions): StorageAdapter {
  const { envPrefix, localRoot, defaultS3Prefix } = options;
  const driver = (getEnv(`${envPrefix}_STORAGE_DRIVER`) ?? "local").toLowerCase();

  if (driver === "s3") {
    const bucket = getEnv(`${envPrefix}_S3_BUCKET`);
    const region = getEnv(`${envPrefix}_S3_REGION`) ?? getEnv("AWS_REGION") ?? "ap-southeast-1";
    if (!bucket) {
      throw new Error(`${envPrefix}_S3_BUCKET is required when ${envPrefix}_STORAGE_DRIVER=s3.`);
    }
    return createS3StorageAdapter({
      bucket,
      region,
      prefix: getEnv(`${envPrefix}_S3_PREFIX`) ?? defaultS3Prefix,
      endpoint: getEnv(`${envPrefix}_S3_ENDPOINT`),
      forcePathStyle: getEnv(`${envPrefix}_S3_FORCE_PATH_STYLE`) === "true",
    });
  }

  return createLocalStorageAdapter(localRoot);
}
