"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth-guards";
import { startOfDay, toISODate } from "@/lib/utils";
import {
  ATTENDANCE_UPLOAD_MAX_FILE_SIZE,
  validateAttendanceUploadFile,
} from "@/lib/attendance/import/file-validation";
import { parseAttendanceFile } from "@/lib/attendance/import/parse-dispatch";
import { importAttendanceRows } from "@/lib/attendance/import/import-records";
import { buildAttendanceImportPreview } from "@/lib/attendance/import/build-preview";
import { rowsProvideAttendanceDates } from "@/lib/attendance/import/types";
import {
  deleteAttendancePreviewCache,
  getAttendancePreviewCache,
  putAttendancePreviewCache,
} from "@/lib/attendance/import/preview-cache";
import type { AttendanceImportPreview } from "@/lib/attendance/import/preview-types";

export type PreviewActionState = {
  error?: string;
  preview?: AttendanceImportPreview;
};

export type ConfirmActionState = {
  error?: string;
  success?: string;
  imported?: number;
  skipped?: number;
  unknownEmployees?: number;
  warnings?: string[];
  durationMs?: number;
  datesImported?: string[];
  reportType?: string;
  fileName?: string;
};

export type CancelPreviewState = {
  error?: string;
  cancelled?: boolean;
};

/**
 * Parse once → validate → cache rows for confirm.
 * Does not write attendance records.
 */
export async function previewAttendanceAction(
  _prev: PreviewActionState,
  formData: FormData
): Promise<PreviewActionState> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const file = formData.get("file") as File | null;
  const attendanceDateStr = String(formData.get("attendanceDate") ?? "").trim();

  if (!file || file.size === 0) {
    return { error: "Please select an Excel (.xlsx/.xls) or PDF (.pdf) file." };
  }
  if (file.size > ATTENDANCE_UPLOAD_MAX_FILE_SIZE) {
    return { error: "File size exceeds 5MB limit." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    const validation = validateAttendanceUploadFile({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      bytes,
    });
    if (!validation.ok) {
      return { error: validation.error };
    }

    const parseResult = await parseAttendanceFile({
      format: validation.format,
      fileName: file.name,
      buffer,
      bytes,
    });
    if (!parseResult.ok) {
      return { error: parseResult.error };
    }

    const reportType = parseResult.reportType ?? (validation.format === "excel" ? "EXCEL_DAILY" : "PDF_DAILY");
    const datesFromFile =
      reportType === "PDF_SUMMARY" ||
      (reportType === "PDF_DAILY" && rowsProvideAttendanceDates(parseResult.rows));

    let formAttendanceDate: Date;
    if (datesFromFile) {
      // Form date unused when rows carry dates; keep a stable fallback for the resolver.
      formAttendanceDate = attendanceDateStr
        ? startOfDay(new Date(attendanceDateStr))
        : startOfDay();
    } else {
      if (!attendanceDateStr) {
        return { error: "Attendance date is required for Daily Excel/PDF imports." };
      }
      formAttendanceDate = startOfDay(new Date(attendanceDateStr));
      if (Number.isNaN(formAttendanceDate.getTime())) {
        return { error: "Invalid attendance date." };
      }
    }

    const previewId = randomUUID();
    const preview = await buildAttendanceImportPreview({
      previewId,
      fileName: file.name,
      fileSize: file.size,
      format: validation.format,
      reportType,
      formAttendanceDate,
      rows: parseResult.rows,
    });

    putAttendancePreviewCache({
      previewId,
      userId: session.id,
      fileName: file.name,
      fileSize: file.size,
      format: validation.format,
      reportType,
      formAttendanceDate,
      rows: parseResult.rows,
      preview,
    });

    return { preview };
  } catch (e) {
    console.error("Attendance preview error:", e);
    return {
      error:
        "Failed to preview attendance file. Please check the format and try again.",
    };
  }
}

/**
 * Confirm import using cached parse result — does not re-parse the file.
 */
export async function confirmAttendanceImportAction(
  _prev: ConfirmActionState,
  formData: FormData
): Promise<ConfirmActionState> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const previewId = String(formData.get("previewId") ?? "").trim();
  if (!previewId) {
    return { error: "Preview expired or missing. Please upload the file again." };
  }

  const cached = getAttendancePreviewCache(previewId, session.id);
  if (!cached) {
    return { error: "Preview expired or missing. Please upload the file again." };
  }

  if (!cached.preview.canConfirm) {
    return {
      error: "This preview has blocking errors. Fix the file or selection before confirming.",
    };
  }

  const started = Date.now();
  try {
    const importResult = await importAttendanceRows({
      session,
      fileName: cached.fileName,
      attendanceDate: cached.formAttendanceDate,
      rows: cached.rows,
      source: cached.format,
    });

    if (!importResult.ok) {
      return { error: importResult.error };
    }

    deleteAttendancePreviewCache(previewId, session.id);

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/attendance");
    revalidatePath("/admin/payroll-attendance");
    revalidatePath("/admin/upload");

    const { imported, skipped, provisioningErrors } = importResult;
    const datesImported = [
      ...new Set(
        cached.preview.rows
          .filter((r) => r.importable && r.attendanceDate)
          .map((r) => r.attendanceDate as string)
      ),
    ].sort();

    const warnings = [
      ...provisioningErrors,
      ...cached.preview.warnings.slice(0, 10).map((w) => w.message),
    ];

    const message = `Imported ${imported} record(s)${skipped > 0 ? `, skipped ${skipped} duplicate(s)` : ""}.`;

    return {
      success: message,
      imported,
      skipped,
      unknownEmployees: 0,
      warnings: warnings.length > 0 ? warnings.slice(0, 15) : undefined,
      durationMs: Date.now() - started,
      datesImported,
      reportType: cached.reportType,
      fileName: cached.fileName,
      error: warnings.length > 0 ? warnings.slice(0, 5).join("; ") : undefined,
    };
  } catch (e) {
    console.error("Attendance confirm import error:", e);
    return { error: "Import failed due to a server error. Please try again." };
  }
}

export async function cancelAttendancePreviewAction(
  _prev: CancelPreviewState,
  formData: FormData
): Promise<CancelPreviewState> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const previewId = String(formData.get("previewId") ?? "").trim();
  if (previewId) {
    deleteAttendancePreviewCache(previewId, session.id);
  }
  return { cancelled: true };
}

// Re-export date helper for UI tests
export { toISODate };
