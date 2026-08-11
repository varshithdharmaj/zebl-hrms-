import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type {
  StorageAdapter,
  StorageObjectMetadata,
  StorageSaveOptions,
} from "@/lib/recruitment/storage/types";

function assertSafeKey(key: string): void {
  if (!key || key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new Error("Invalid storage key.");
  }
  if (key.includes("//")) {
    throw new Error("Invalid storage key.");
  }
}

async function streamToBuffer(
  body: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array> | Blob | undefined
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export type S3StorageAdapterOptions = {
  bucket: string;
  region: string;
  prefix?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
};

/**
 * S3-compatible object storage for recruitment documents (AWS S3, MinIO, etc.).
 */
export function createS3StorageAdapter(options: S3StorageAdapterOptions): StorageAdapter {
  const prefix = (options.prefix ?? "").replace(/^\/+|\/+$/g, "");
  const client = new S3Client({
    region: options.region,
    ...(options.endpoint
      ? { endpoint: options.endpoint, forcePathStyle: options.forcePathStyle ?? true }
      : {}),
  });

  const objectKey = (key: string): string => {
    assertSafeKey(key);
    return prefix ? `${prefix}/${key}` : key;
  };

  return {
    async save(
      key: string,
      data: Buffer | Uint8Array,
      saveOptions?: StorageSaveOptions
    ): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: objectKey(key),
          Body: data,
          ContentType: saveOptions?.contentType ?? undefined,
        })
      );
    },

    async read(key: string): Promise<Buffer> {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: options.bucket,
          Key: objectKey(key),
        })
      );
      return streamToBuffer(result.Body as AsyncIterable<Uint8Array> | undefined);
    },

    async delete(key: string): Promise<void> {
      await client.send(
        new DeleteObjectCommand({
          Bucket: options.bucket,
          Key: objectKey(key),
        })
      );
    },

    async exists(key: string): Promise<boolean> {
      try {
        await client.send(
          new HeadObjectCommand({
            Bucket: options.bucket,
            Key: objectKey(key),
          })
        );
        return true;
      } catch (error) {
        const name =
          typeof error === "object" && error && "name" in error
            ? String((error as { name?: string }).name)
            : "";
        const status =
          typeof error === "object" && error && "$metadata" in error
            ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
                ?.httpStatusCode
            : undefined;
        if (name === "NotFound" || name === "NoSuchKey" || status === 404) {
          return false;
        }
        throw error;
      }
    },

    async getMetadata(key: string): Promise<StorageObjectMetadata | null> {
      try {
        const result = await client.send(
          new HeadObjectCommand({
            Bucket: options.bucket,
            Key: objectKey(key),
          })
        );
        return {
          sizeBytes: result.ContentLength ?? 0,
          contentType: result.ContentType ?? null,
          lastModified: result.LastModified,
        };
      } catch (error) {
        const name =
          typeof error === "object" && error && "name" in error
            ? String((error as { name?: string }).name)
            : "";
        const status =
          typeof error === "object" && error && "$metadata" in error
            ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
                ?.httpStatusCode
            : undefined;
        if (name === "NotFound" || name === "NoSuchKey" || status === 404) {
          return null;
        }
        throw error;
      }
    },
  };
}
