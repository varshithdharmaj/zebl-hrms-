import { mkdir, readFile, writeFile, unlink, stat, access } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import type {
  StorageAdapter,
  StorageObjectMetadata,
  StorageSaveOptions,
} from "@/lib/recruitment/storage/types";

function assertSafeKey(key: string): void {
  if (!key || key.includes("..") || key.includes("\\") || path.isAbsolute(key)) {
    throw new Error("Invalid storage key.");
  }
  if (key.startsWith("/") || key.includes("//")) {
    throw new Error("Invalid storage key.");
  }
}

function resolveKeyPath(rootDir: string, key: string): string {
  assertSafeKey(key);
  const root = path.resolve(rootDir);
  const full = path.resolve(root, key);
  const relative = path.relative(root, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Storage key escapes root.");
  }
  return full;
}

/**
 * Local filesystem adapter. Absolute paths stay inside this module.
 */
export function createLocalStorageAdapter(rootDir: string): StorageAdapter {
  const root = path.resolve(rootDir);

  return {
    async save(
      key: string,
      data: Buffer | Uint8Array,
      _options?: StorageSaveOptions
    ): Promise<void> {
      const fullPath = resolveKeyPath(root, key);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, data);
    },

    async read(key: string): Promise<Buffer> {
      const fullPath = resolveKeyPath(root, key);
      return readFile(fullPath);
    },

    async delete(key: string): Promise<void> {
      const fullPath = resolveKeyPath(root, key);
      try {
        await unlink(fullPath);
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String((error as { code?: string }).code)
            : "";
        if (code !== "ENOENT") throw error;
      }
    },

    async exists(key: string): Promise<boolean> {
      const fullPath = resolveKeyPath(root, key);
      try {
        await access(fullPath, constants.F_OK);
        return true;
      } catch {
        return false;
      }
    },

    async getMetadata(key: string): Promise<StorageObjectMetadata | null> {
      const fullPath = resolveKeyPath(root, key);
      try {
        const info = await stat(fullPath);
        if (!info.isFile()) return null;
        return {
          sizeBytes: info.size,
          lastModified: info.mtime,
        };
      } catch {
        return null;
      }
    },
  };
}
