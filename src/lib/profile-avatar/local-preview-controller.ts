import { validateProfileAvatarFile } from "./file-validation";

export type ObjectUrlApi = {
  createObjectURL: (obj: Blob | MediaSource) => string;
  revokeObjectURL: (url: string) => void;
};

export type LocalImagePreviewSnapshot = {
  file: File | null;
  previewUrl: string | null;
  cleared: boolean;
  error: string | null;
};

/**
 * Storage-agnostic local preview controller.
 * Future upload services should consume `file` from successful `select()` results —
 * this module never performs network I/O.
 */
export function createLocalImagePreviewController(options?: {
  objectUrlApi?: ObjectUrlApi;
}): {
  getState: () => LocalImagePreviewSnapshot;
  select: (file: File | null | undefined) => LocalImagePreviewSnapshot;
  clear: () => LocalImagePreviewSnapshot;
  dispose: () => void;
} {
  const objectUrlApi = options?.objectUrlApi ?? {
    createObjectURL: (obj) => URL.createObjectURL(obj),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  };

  let state: LocalImagePreviewSnapshot = {
    file: null,
    previewUrl: null,
    cleared: false,
    error: null,
  };

  function revokeCurrent(): void {
    if (state.previewUrl) {
      objectUrlApi.revokeObjectURL(state.previewUrl);
    }
  }

  function select(file: File | null | undefined): LocalImagePreviewSnapshot {
    const result = validateProfileAvatarFile(file);
    if (!result.ok) {
      state = {
        ...state,
        error: result.error,
      };
      return state;
    }

    revokeCurrent();
    const previewUrl = objectUrlApi.createObjectURL(result.file);
    state = {
      file: result.file,
      previewUrl,
      cleared: false,
      error: null,
    };
    return state;
  }

  function clear(): LocalImagePreviewSnapshot {
    revokeCurrent();
    state = {
      file: null,
      previewUrl: null,
      cleared: true,
      error: null,
    };
    return state;
  }

  function dispose(): void {
    revokeCurrent();
    state = {
      file: null,
      previewUrl: null,
      cleared: state.cleared,
      error: null,
    };
  }

  return {
    getState: () => state,
    select,
    clear,
    dispose,
  };
}
