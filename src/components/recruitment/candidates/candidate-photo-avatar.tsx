"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProfileAvatar, type ProfileAvatarUploadStatus } from "@/components/shared/profile-avatar";
import { removeCandidatePhotoAction, uploadCandidatePhotoAction } from "@/actions/candidate-photo";

export function CandidatePhotoAvatar({
  candidateId,
  fullName,
  photoDocumentId,
  editable,
}: {
  candidateId: string;
  fullName: string;
  photoDocumentId: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProfileAvatarUploadStatus>("idle");
  const savedStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageUrl = photoDocumentId
    ? `/api/recruitment/documents/preview?id=${photoDocumentId}`
    : null;

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
      formData.set("candidateId", candidateId);
      formData.set("file", file);
      const result = await uploadCandidatePhotoAction({}, formData);
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
      formData.set("candidateId", candidateId);
      const result = await removeCandidatePhotoAction({}, formData);
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
        alt={`${fullName} profile photo`}
        editable={editable}
        size="lg"
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
