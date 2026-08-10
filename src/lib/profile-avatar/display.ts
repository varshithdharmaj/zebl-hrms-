import { DEFAULT_PROFILE_AVATAR_SRC } from "./constants";

export type ProfileAvatarDisplayInput = {
  /** Local object-URL preview from a selected File. */
  previewUrl: string | null;
  /** Persisted remote URL from a future backend (optional today). */
  imageUrl: string | null | undefined;
  /** True after the user explicitly removed the current photo. */
  cleared: boolean;
  defaultSrc?: string;
};

/**
 * Resolves which image source to show.
 * Local preview wins; after clear, fall back to the default asset (not the prior URL).
 */
export function resolveProfileAvatarSrc(input: ProfileAvatarDisplayInput): string {
  const defaultSrc = input.defaultSrc ?? DEFAULT_PROFILE_AVATAR_SRC;

  if (input.previewUrl) {
    return input.previewUrl;
  }

  if (input.cleared) {
    return defaultSrc;
  }

  const persisted = input.imageUrl?.trim();
  if (persisted) {
    return persisted;
  }

  return defaultSrc;
}

export function profileAvatarHasCustomImage(input: ProfileAvatarDisplayInput): boolean {
  return resolveProfileAvatarSrc(input) !== (input.defaultSrc ?? DEFAULT_PROFILE_AVATAR_SRC);
}
