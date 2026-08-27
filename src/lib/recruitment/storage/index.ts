export type { StorageAdapter, StorageObjectMetadata, StorageSaveOptions } from "./types";
export { createLocalStorageAdapter } from "./local-storage-adapter";
export { createMemoryStorageAdapter } from "./memory-storage-adapter";
export { createS3StorageAdapter } from "./s3-storage-adapter";
export { createConfiguredStorage, type ConfiguredStorageOptions } from "./configured-storage";
export {
  getRecruitmentStorage,
  getRecruitmentStorageRoot,
  setRecruitmentStorageForTests,
} from "./recruitment-storage";
