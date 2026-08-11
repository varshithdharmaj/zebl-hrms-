/** Shared static default avatar — do not duplicate per employee/candidate. */
export const DEFAULT_PROFILE_AVATAR_SRC = "/avatars/default-avatar.svg";

export const PROFILE_AVATAR_MAX_BYTES = 500 * 1024; // 500 KB

export const PROFILE_AVATAR_ACCEPT =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export const PROFILE_AVATAR_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ProfileAvatarMimeType = (typeof PROFILE_AVATAR_MIME_TYPES)[number];
