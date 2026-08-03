"use client";

import { UploadFormDirect } from "@/components/admin/upload-form-direct";
import { UploadFormPreview } from "@/components/admin/upload-form-preview";

/**
 * Attendance upload entry.
 * Workflow is selected by `previewEnabled` (from ENABLE_ATTENDANCE_IMPORT_PREVIEW).
 * Default false → direct import; true → Phase 5 preview → confirm.
 */
export function UploadForm({
  defaultDate,
  previewEnabled = false,
}: {
  defaultDate: string;
  previewEnabled?: boolean;
}) {
  if (previewEnabled) {
    return <UploadFormPreview defaultDate={defaultDate} />;
  }
  return <UploadFormDirect defaultDate={defaultDate} />;
}
