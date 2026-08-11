export type StorageObjectMetadata = {
  sizeBytes: number;
  contentType?: string | null;
  lastModified?: Date;
};

export type StorageSaveOptions = {
  contentType?: string | null;
};

/**
 * Opaque object storage for recruitment documents.
 * Keys are logical (e.g. candidates/{id}/documents/...); adapters never
 * expose filesystem paths to callers.
 */
export type StorageAdapter = {
  save(
    key: string,
    data: Buffer | Uint8Array,
    options?: StorageSaveOptions
  ): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<StorageObjectMetadata | null>;
};

export type StorageAdapterFactory = () => StorageAdapter;
