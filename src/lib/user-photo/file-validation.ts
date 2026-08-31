import { PROFILE_AVATAR_MAX_BYTES } from "@/lib/profile-avatar/constants";

const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_RIFF_SIGNATURE = Buffer.from("RIFF", "ascii");
const WEBP_FORMAT_SIGNATURE = Buffer.from("WEBP", "ascii");

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

export class UserPhotoValidationError extends Error {}

/**
 * Server-side re-check for profile photo uploads — the client-side
 * validateProfileAvatarFile() (src/lib/profile-avatar/file-validation.ts)
 * is UI-only and must never be trusted alone. Extension + MIME + magic-byte
 * sniffing, same style as the recruitment public-apply photo validator.
 */
export function assertUserPhotoFile(fileName: string, mimeType: string, content: Buffer): void {
  const ext = extensionOf(fileName);
  if (ext !== "jpg" && ext !== "jpeg" && ext !== "png" && ext !== "webp") {
    throw new UserPhotoValidationError("Only JPEG, PNG, or WebP images are supported.");
  }
  if (content.byteLength <= 0) {
    throw new UserPhotoValidationError("The selected file is empty.");
  }
  if (content.byteLength > PROFILE_AVATAR_MAX_BYTES) {
    throw new UserPhotoValidationError(
      `Photo is too large. Maximum size is ${Math.round(PROFILE_AVATAR_MAX_BYTES / 1024)} KB.`
    );
  }

  const head = content.subarray(0, 12);
  const looksJpeg = (ext === "jpg" || ext === "jpeg") && head.subarray(0, 3).equals(JPEG_SIGNATURE);
  const looksPng = ext === "png" && head.subarray(0, 8).equals(PNG_SIGNATURE);
  const looksWebp =
    ext === "webp" &&
    head.subarray(0, 4).equals(WEBP_RIFF_SIGNATURE) &&
    head.subarray(8, 12).equals(WEBP_FORMAT_SIGNATURE);
  if (!looksJpeg && !looksPng && !looksWebp) {
    throw new UserPhotoValidationError("This file doesn't look like a valid photo.");
  }

  void mimeType; // MIME header is informational only — extension + magic bytes decide.
}
