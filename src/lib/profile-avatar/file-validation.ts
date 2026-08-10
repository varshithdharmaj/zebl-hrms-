import {
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_AVATAR_MIME_TYPES,
  type ProfileAvatarMimeType,
} from "./constants";

export type ProfileAvatarFileValidationResult =
  | { ok: true; file: File }
  | { ok: false; error: string };

const ALLOWED_MIME = new Set<string>(PROFILE_AVATAR_MIME_TYPES);

const EXTENSION_TO_MIME: Record<string, ProfileAvatarMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function getExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

export function formatProfileAvatarFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return Number.isInteger(kb) ? `${kb} KB` : `${kb.toFixed(1)} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Client-side gate for profile photo selection.
 * Future upload services should re-validate on the server; this does not upload.
 */
export function validateProfileAvatarFile(
  file: File | null | undefined
): ProfileAvatarFileValidationResult {
  if (!file) {
    return { ok: false, error: "Please select a photo." };
  }

  const extension = getExtension(file.name);
  const mimeFromExtension = EXTENSION_TO_MIME[extension];
  const mime = (file.type || "").toLowerCase().trim();

  const mimeOk = mime ? ALLOWED_MIME.has(mime) : Boolean(mimeFromExtension);
  const extensionOk = Boolean(mimeFromExtension);

  if (!mimeOk || !extensionOk) {
    return {
      ok: false,
      error: "Only JPEG, PNG, or WebP images are supported.",
    };
  }

  if (file.size <= 0) {
    return { ok: false, error: "The selected file is empty." };
  }

  if (file.size > PROFILE_AVATAR_MAX_BYTES) {
    return {
      ok: false,
      error: `Photo is too large. Maximum size is ${formatProfileAvatarFileSize(PROFILE_AVATAR_MAX_BYTES)}.`,
    };
  }

  return { ok: true, file };
}
