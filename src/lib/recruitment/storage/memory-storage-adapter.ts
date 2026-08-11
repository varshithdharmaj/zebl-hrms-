import type { StorageAdapter } from "@/lib/recruitment/storage/types";

/** In-memory adapter for unit tests. */
export function createMemoryStorageAdapter(): StorageAdapter {
  const store = new Map<string, Buffer>();

  return {
    async save(key, data) {
      store.set(key, Buffer.from(data));
    },
    async read(key) {
      const value = store.get(key);
      if (!value) throw new Error(`Object not found: ${key}`);
      return value;
    },
    async delete(key) {
      store.delete(key);
    },
    async exists(key) {
      return store.has(key);
    },
    async getMetadata(key) {
      const value = store.get(key);
      if (!value) return null;
      return { sizeBytes: value.byteLength };
    },
  };
}
