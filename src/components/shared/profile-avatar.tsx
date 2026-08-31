"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PROFILE_AVATAR_ACCEPT } from "@/lib/profile-avatar/constants";
import {
  profileAvatarHasCustomImage,
  resolveProfileAvatarSrc,
} from "@/lib/profile-avatar/display";
import { useLocalImagePreview } from "@/lib/profile-avatar/use-local-image-preview";

const SIZE_CLASS = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-28 w-28",
} as const;

/**
 * Declarative status the caller reports for its in-flight server upload/remove
 * action. `ProfileAvatar` reacts to `"error"` by discarding its optimistic
 * local preview and falling back to the still-valid `imageUrl` — the caller
 * doesn't need an imperative ref to trigger this.
 */
export type ProfileAvatarUploadStatus = "idle" | "uploading" | "saved" | "error";

export type ProfileAvatarProps = {
  /** Persisted, server-served image URL (e.g. /api/profile-photo/:userId). */
  imageUrl?: string | null;
  alt: string;
  /** When true, shows Upload / Change / Remove controls. */
  editable?: boolean;
  size?: keyof typeof SIZE_CLASS;
  disabled?: boolean;
  className?: string;
  /**
   * Invoked after a valid local file is selected, showing an optimistic local
   * preview immediately. The caller is responsible for uploading the file and
   * persisting it — this component never uploads on its own.
   */
  onImageSelected?: (file: File) => void;
  /** Invoked when the user clears the local (or future persisted) photo. */
  onImageRemoved?: () => void;
  /**
   * Status of the caller's in-flight upload/remove server action. Defaults to
   * `"idle"`. Set to `"uploading"` while the action is pending (shows the
   * busy/spinner state), and to `"error"` when it fails — which reverts the
   * optimistic preview back to the persisted `imageUrl` without treating the
   * failure as a remove. `"saved"` is accepted for the caller's own transient
   * confirmation UI; this component doesn't need to react to it.
   */
  uploadStatus?: ProfileAvatarUploadStatus;
};

export function ProfileAvatar({
  imageUrl = null,
  alt,
  editable = false,
  size = "md",
  disabled = false,
  className,
  onImageSelected,
  onImageRemoved,
  uploadStatus = "idle",
}: ProfileAvatarProps) {
  const inputId = useId();
  const describedById = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [remoteLoadFailed, setRemoteLoadFailed] = useState(false);

  const { state, selectFile, clear, revert } = useLocalImagePreview({
    onImageSelected,
    onImageRemoved,
  });

  useEffect(() => {
    setRemoteLoadFailed(false);
  }, [imageUrl]);

  useEffect(() => {
    if (uploadStatus === "error") {
      revert();
    }
  }, [uploadStatus, revert]);

  const displaySrc = resolveProfileAvatarSrc({
    previewUrl: state.previewUrl,
    imageUrl,
    cleared: state.cleared,
    remoteLoadFailed,
  });
  const hasCustomImage = profileAvatarHasCustomImage({
    previewUrl: state.previewUrl,
    imageUrl,
    cleared: state.cleared,
    remoteLoadFailed,
  });
  const actionLabel = hasCustomImage ? "Change photo" : "Upload photo";
  const isBusy = state.isProcessing || uploadStatus === "uploading";
  const controlsDisabled = disabled || isBusy;

  function openPicker() {
    if (controlsDisabled) return;
    inputRef.current?.click();
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    selectFile(file);
    // Allow re-selecting the same file path after a rejected attempt.
    event.target.value = "";
  }

  function handleRemove() {
    if (controlsDisabled) return;
    clear();
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs + static default; no remote domain config */}
        <img
          src={displaySrc}
          alt={alt}
          width={112}
          height={112}
          className={cn(
            SIZE_CLASS[size],
            "rounded-full object-cover border border-border bg-muted shadow-subtle",
            isBusy && "opacity-70"
          )}
          onError={() => {
            // Keep fallback in React state — mutating img.src is overwritten by controlled `src={displaySrc}`.
            if (!state.previewUrl) {
              setRemoteLoadFailed(true);
            }
          }}
        />
        {editable && (
          <button
            type="button"
            onClick={openPicker}
            disabled={controlsDisabled}
            aria-label={actionLabel}
            aria-describedby={describedById}
            className={cn(
              "absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full",
              "border border-border bg-card text-foreground shadow-subtle",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            <Camera className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {editable ? (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={openPicker}
              disabled={controlsDisabled}
              loading={isBusy}
              aria-describedby={state.error ? `${describedById} ${errorId}` : describedById}
            >
              {actionLabel}
            </Button>
            {hasCustomImage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={controlsDisabled}
                aria-label="Remove photo"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Remove
              </Button>
            )}
          </div>
          <p id={describedById} className="max-w-[14rem] text-center text-[11px] text-muted-foreground">
            JPEG, PNG, or WebP · max 500 KB.
          </p>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={PROFILE_AVATAR_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            disabled={controlsDisabled}
            aria-hidden
            onChange={handleInputChange}
          />
        </div>
      ) : null}

      {editable && state.error ? (
        <p id={errorId} role="alert" className="max-w-[16rem] text-center text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
