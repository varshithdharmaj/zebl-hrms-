"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth-guards";
import { startOfDay } from "@/lib/utils";
import {
  ATTENDANCE_UPLOAD_MAX_FILE_SIZE,
  validateAttendanceUploadFile,
} from "@/lib/attendance/import/file-validation";
import { parseAttendanceExcel } from "@/lib/attendance/import/parse-excel";
import { parseAttendancePdf } from "@/lib/attendance/import/parse-pdf";
import { importAttendanceRows } from "@/lib/attendance/import/import-records";

export type UploadState = {
  error?: string;
  success?: string;
  imported?: number;
  skipped?: number;
  /** PDF rows rejected because the employee code does not exist (not auto-created). */
  unknownEmployees?: number;
};

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

  if (!file || file.size === 0) {
    return { error: "Please select an Excel (.xlsx/.xls) or PDF (.pdf) file." };
  }

  // Reject oversized uploads before allocating a buffer
  if (file.size > ATTENDANCE_UPLOAD_MAX_FILE_SIZE) {
    return { error: "File size exceeds 5MB limit." };
  }

  if (!attendanceDateStr) {
    return { error: "Attendance date is required." };
  }

  const attendanceDate = startOfDay(new Date(attendanceDateStr));
  if (Number.isNaN(attendanceDate.getTime())) {
    return { error: "Invalid attendance date." };
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

    const parseResult =
      validation.format === "pdf"
        ? await parseAttendancePdf(bytes)
        : parseAttendanceExcel(buffer);

    if (!parseResult.ok) {
      return { error: parseResult.error };
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

    const { imported, skipped, provisioningErrors, rejectedUnknownEmployees } = importResult;
    const message = `Imported ${imported} record(s)${skipped > 0 ? `, skipped ${skipped} duplicate(s)` : ""}.`;
    const unknownEmployees = rejectedUnknownEmployees.length;

    const softErrors = [
      ...provisioningErrors,
      ...rejectedUnknownEmployees.map(
        (code) => `${code}: unknown employee (PDF import does not create employees)`
      ),
    ];

    if (softErrors.length > 0) {
      return {
        success: message,
        imported,
        skipped,
        unknownEmployees,
        error: softErrors.slice(0, 5).join("; "),
      };
    }

    return { success: message, imported, skipped, unknownEmployees };
  } catch (e) {
    console.error("Upload error:", e);
    return {
      error:
        "Failed to process attendance file. Please check the format and try again, or use Excel import.",
    };
  }
}
