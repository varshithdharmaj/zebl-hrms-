"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProfileAvatar, type ProfileAvatarUploadStatus } from "@/components/shared/profile-avatar";
import { removeProfilePhotoAction, uploadProfilePhotoAction } from "@/actions/user-photo";

/**
 * Wires ProfileAvatar to the canonical employee-photo server actions
 * (uploadProfilePhotoAction / removeProfilePhotoAction, User.profilePhotoStorageKey).
 * Shared by every place an editable employee/admin photo avatar is shown —
 * currently the HR admin employee editor and the employee self-service
 * profile page — so this upload/remove/status/revert state machine exists
 * in exactly one place. ProfileAvatar itself stays presentational and has
 * no knowledge of which server action it's driving.
 */
export function EmployeePhotoAvatar({
  userId,
  imageUrl,
  alt,
  editable,
  size = "lg",
}: {
  userId: string;
  imageUrl: string | null;
  alt: string;
  editable: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProfileAvatarUploadStatus>("idle");
  const savedStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
    };
  }, []);

  function showSavedThenIdle() {
    setStatus("saved");
    if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
    savedStatusTimeoutRef.current = setTimeout(() => setStatus("idle"), 2000);
  }

  function handleSelected(file: File) {
    if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
    setError(null);
    setStatus("uploading");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      formData.set("file", file);
      const result = await uploadProfilePhotoAction({}, formData);
      if (result.error) {
        setError(result.error);
        setStatus("error");
        return;
      }
      showSavedThenIdle();
      router.refresh();
    });
  }

  function handleRemoved() {
    if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
    setError(null);
    setStatus("uploading");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("userId", userId);
      const result = await removeProfilePhotoAction({}, formData);
      if (result.error) {
        setError(result.error);
        setStatus("error");
        return;
      }
      showSavedThenIdle();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <ProfileAvatar
        imageUrl={imageUrl}
        alt={alt}
        editable={editable}
        size={size}
        onImageSelected={handleSelected}
        onImageRemoved={handleRemoved}
        uploadStatus={status}
      />
      {error && <p className="max-w-[14rem] text-center text-[11px] text-danger">{error}</p>}
      {!error && status === "saved" && (
        <p className="text-[11px] font-medium text-success">Saved ✓</p>
      )}
    </div>
  );
}
