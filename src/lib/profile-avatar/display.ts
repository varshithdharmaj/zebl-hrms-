import { DEFAULT_PROFILE_AVATAR_SRC } from "./constants";

export type ProfileAvatarDisplayInput = {
  /** Local object-URL preview from a selected File. */
  previewUrl: string | null;
  /** Persisted remote URL from a future backend (optional today). */
  imageUrl: string | null | undefined;
  /** True after the user explicitly removed the current photo. */
  cleared: boolean;
  /** True when a remote `imageUrl` failed to load in the browser. */
  remoteLoadFailed?: boolean;
  defaultSrc?: string;
};

/**
 * Coerce a stored profile photo value into a browser-displayable URL.
 * Empty strings and Microsoft Graph binary photo endpoints are treated as missing —
 * those Graph URLs require auth headers and cannot be used as `<img src>`.
 */
export function coerceProfileImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return null;

  if (
    /graph\.microsoft\.com/i.test(trimmed) &&
    /\/photo\/\$value(?:\?|$)/i.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

/**
 * Resolves which image source to show.
 * Local preview wins; after clear / failed remote load, fall back to the default asset.
 */
export function resolveProfileAvatarSrc(input: ProfileAvatarDisplayInput): string {
  const defaultSrc = input.defaultSrc ?? DEFAULT_PROFILE_AVATAR_SRC;

  if (input.previewUrl) {
    return input.previewUrl;
  }

  if (input.cleared || input.remoteLoadFailed) {
    return defaultSrc;
  }

  const persisted = coerceProfileImageUrl(input.imageUrl);
  if (persisted) {
    return persisted;
  }

  return defaultSrc;
}

export function profileAvatarHasCustomImage(input: ProfileAvatarDisplayInput): boolean {
  return resolveProfileAvatarSrc(input) !== (input.defaultSrc ?? DEFAULT_PROFILE_AVATAR_SRC);
}
