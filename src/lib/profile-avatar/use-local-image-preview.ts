"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLocalImagePreviewController,
  type LocalImagePreviewSnapshot,
  type ObjectUrlApi,
} from "./local-preview-controller";

export type LocalImagePreviewState = LocalImagePreviewSnapshot & {
  isProcessing: boolean;
};

/**
 * React adapter around the storage-agnostic local preview controller.
 * Call sites can forward selected files to a future upload service via `onImageSelected`.
 */
export function useLocalImagePreview(options?: {
  objectUrlApi?: ObjectUrlApi;
  onImageSelected?: (file: File) => void;
  onImageRemoved?: () => void;
}): {
  state: LocalImagePreviewState;
  selectFile: (file: File | null | undefined) => void;
  clear: () => void;
} {
  const onImageSelectedRef = useRef(options?.onImageSelected);
  const onImageRemovedRef = useRef(options?.onImageRemoved);
  onImageSelectedRef.current = options?.onImageSelected;
  onImageRemovedRef.current = options?.onImageRemoved;

  const controllerRef = useRef(
    createLocalImagePreviewController({ objectUrlApi: options?.objectUrlApi })
  );

  const [snapshot, setSnapshot] = useState<LocalImagePreviewSnapshot>(
    controllerRef.current.getState()
  );
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const controller = controllerRef.current;
    return () => {
      controller.dispose();
    };
  }, []);

  const selectFile = useCallback((next: File | null | undefined) => {
    setIsProcessing(true);
    try {
      const nextState = controllerRef.current.select(next);
      setSnapshot(nextState);
      if (nextState.file && !nextState.error) {
        onImageSelectedRef.current?.(nextState.file);
      }
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const clear = useCallback(() => {
    const nextState = controllerRef.current.clear();
    setSnapshot(nextState);
    onImageRemovedRef.current?.();
  }, []);

  return {
    state: { ...snapshot, isProcessing },
    selectFile,
    clear,
  };
}
