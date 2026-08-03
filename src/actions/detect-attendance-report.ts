"use server";

import { requireAdminSession } from "@/lib/auth-guards";
import { ATTENDANCE_UPLOAD_MAX_FILE_SIZE } from "@/lib/attendance/import/file-validation";
import { getAttendanceReportMetadata } from "@/lib/attendance/import/detect-upload-metadata";
import {
  buildAttendanceReportMetadata,
  type AttendanceReportMetadata,
} from "@/lib/attendance/import/report-metadata";

export type DetectAttendanceReportState =
  | { ok: true; metadata: AttendanceReportMetadata }
  | { ok: false; error: string };

/**
 * Admin-only UX probe: classify upload for date-field visibility.
 * Does not write to the DB and does not run attendance row parsers.
 */
export async function detectAttendanceReportMetadataAction(
  formData: FormData
): Promise<DetectAttendanceReportState> {
  try {
    await requireAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized." };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { ok: false, error: "Please select an Excel (.xlsx/.xls) or PDF (.pdf) file." };
  }
  if (file.size > ATTENDANCE_UPLOAD_MAX_FILE_SIZE) {
    return { ok: false, error: "File size exceeds 5MB limit." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return getAttendanceReportMetadata({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      bytes,
    });
  } catch (e) {
    console.error("Attendance report detection error:", e);
    return {
      ok: true,
      metadata: buildAttendanceReportMetadata("UNKNOWN"),
    };
  }
}
