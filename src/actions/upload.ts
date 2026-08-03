"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth-guards";
import { startOfDay } from "@/lib/utils";
import {
  ATTENDANCE_UPLOAD_MAX_FILE_SIZE,
  validateAttendanceUploadFile,
} from "@/lib/attendance/import/file-validation";
import { parseAttendanceFile } from "@/lib/attendance/import/parse-dispatch";
import { importAttendanceRows } from "@/lib/attendance/import/import-records";

export type UploadState = {
  error?: string;
  success?: string;
  imported?: number;
  skipped?: number;
  /** PDF rows rejected because the employee code does not exist (not auto-created). */
  unknownEmployees?: number;
  reportType?: string;
  durationMs?: number;
  datesImported?: string[];
};

/**
 * Direct import path (default when preview is disabled).
 * Reuses parseAttendanceFile + importAttendanceRows — no preview cache.
 */
export async function uploadAttendanceAction(
  _prev: UploadState,
  formData: FormData
): Promise<UploadState> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const file = formData.get("file") as File | null;
  const attendanceDateStr = String(formData.get("attendanceDate") ?? "").trim();
  const started = Date.now();

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

    const reportType =
      parseResult.reportType ?? (validation.format === "excel" ? "EXCEL_DAILY" : "PDF_DAILY");
    const datesFromFile = reportType === "PDF_SUMMARY";

    let attendanceDate: Date;
    if (datesFromFile) {
      attendanceDate = attendanceDateStr
        ? startOfDay(new Date(attendanceDateStr))
        : startOfDay();
      if (Number.isNaN(attendanceDate.getTime())) {
        attendanceDate = startOfDay();
      }
    } else {
      if (!attendanceDateStr) {
        return { error: "Attendance date is required." };
      }
      attendanceDate = startOfDay(new Date(attendanceDateStr));
      if (Number.isNaN(attendanceDate.getTime())) {
        return { error: "Invalid attendance date." };
      }
    }

    const importResult = await importAttendanceRows({
      session,
      fileName: file.name,
      attendanceDate,
      rows: parseResult.rows,
      source: validation.format,
    });

    if (!importResult.ok) {
      return { error: importResult.error };
    }

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/attendance");
    revalidatePath("/admin/payroll-attendance");
    revalidatePath("/admin/upload");

    const { imported, skipped, provisioningErrors } = importResult;
    const message = `Imported ${imported} record(s)${skipped > 0 ? `, skipped ${skipped} duplicate(s)` : ""}.`;
    const unknownEmployees = 0;

    const datesImported = [
      ...new Set(
        parseResult.rows
          .map((r) => r.attendanceDate)
          .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
          .map((d) => {
            const x = startOfDay(d);
            const y = x.getFullYear();
            const m = String(x.getMonth() + 1).padStart(2, "0");
            const day = String(x.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
          })
      ),
    ].sort();

    if (!datesFromFile) {
      const y = attendanceDate.getFullYear();
      const m = String(attendanceDate.getMonth() + 1).padStart(2, "0");
      const day = String(attendanceDate.getDate()).padStart(2, "0");
      const formIso = `${y}-${m}-${day}`;
      if (!datesImported.includes(formIso)) datesImported.push(formIso);
      datesImported.sort();
    }

    const softErrors = [...provisioningErrors];

    const base = {
      imported,
      skipped,
      unknownEmployees,
      reportType,
      durationMs: Date.now() - started,
      datesImported: datesImported.length > 0 ? datesImported : undefined,
    };

    if (softErrors.length > 0) {
      return {
        success: message,
        ...base,
        error: softErrors.slice(0, 5).join("; "),
      };
    }

    return { success: message, ...base };
  } catch (e) {
    console.error("Upload error:", e);
    return {
      error:
        "Failed to process attendance file. Please check the format and try again, or use Excel import.",
    };
  }
}
