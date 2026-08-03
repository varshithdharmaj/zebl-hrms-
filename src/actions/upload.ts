"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth-guards";
import { startOfDay } from "@/lib/utils";
import {
  ATTENDANCE_UPLOAD_MAX_FILE_SIZE,
  validateAttendanceUploadFile,
} from "@/lib/attendance/import/file-validation";
import { parseAttendanceFile } from "@/lib/attendance/import/parse-dispatch";
import {
  createAttendanceImportJob,
  processAttendanceImportJob,
  resumeAttendanceImportJob,
  listResumableAttendanceImportJobs,
  type ProcessAttendanceImportJobResult,
} from "@/lib/attendance/import/import-job";
import { rowsProvideAttendanceDates } from "@/lib/attendance/import/types";

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
  /** Resumable job id when import failed mid-way. */
  jobId?: string;
  jobStatus?: string;
  nextRowIndex?: number;
  totalRows?: number;
  employeesCreated?: number;
};

function revalidateAttendancePaths(): void {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/payroll-attendance");
  revalidatePath("/admin/upload");
}

function toIsoDate(d: Date): string {
  const x = startOfDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mapProcessResultToState(
  result: ProcessAttendanceImportJobResult,
  extras: {
    started: number;
    reportType?: string;
    datesImported?: string[];
  }
): UploadState {
  const base = {
    imported: result.imported,
    skipped: result.skipped,
    unknownEmployees: 0,
    reportType: extras.reportType,
    durationMs: Date.now() - extras.started,
    datesImported: extras.datesImported,
    jobId: result.jobId,
    jobStatus: result.status,
    nextRowIndex: result.nextRowIndex,
    totalRows: result.totalRows,
    employeesCreated: result.employeesCreated,
  };

  if (result.ok) {
    const message = `Imported ${result.imported} record(s)${result.skipped > 0 ? `, skipped ${result.skipped} duplicate(s)` : ""}.`;
    const softErrors = [...result.provisioningErrors];
    if (softErrors.length > 0) {
      return {
        success: message,
        ...base,
        error: softErrors.slice(0, 5).join("; "),
      };
    }
    return { success: message, ...base };
  }

  const progressHint =
    result.totalRows > 0
      ? ` Progress: ${result.nextRowIndex}/${result.totalRows} rows processed (${result.imported} imported, ${result.skipped} skipped).`
      : "";

  return {
    ...base,
    error: `${result.error}${progressHint}`,
  };
}

/**
 * Direct import path: parse → create job → process in chunks (resumable).
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
    const datesFromFile =
      reportType === "PDF_SUMMARY" ||
      (reportType === "PDF_DAILY" && rowsProvideAttendanceDates(parseResult.rows));

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

    const created = await createAttendanceImportJob({
      session,
      fileName: file.name,
      source: validation.format,
      reportType,
      formAttendanceDate: attendanceDate,
      rows: parseResult.rows,
    });

    if (!created.ok) {
      return { error: created.error };
    }

    const processResult = await processAttendanceImportJob(created.jobId, session);

    const datesImported = [
      ...new Set(
        parseResult.rows
          .map((r) => r.attendanceDate)
          .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
          .map((d) => toIsoDate(d))
      ),
    ].sort();

    if (!datesFromFile) {
      const formIso = toIsoDate(attendanceDate);
      if (!datesImported.includes(formIso)) datesImported.push(formIso);
      datesImported.sort();
    }

    if (processResult.ok) {
      revalidateAttendancePaths();
    }

    return mapProcessResultToState(processResult, {
      started,
      reportType,
      datesImported: datesImported.length > 0 ? datesImported : undefined,
    });
  } catch (e) {
    console.error("Upload error:", e);
    return {
      error:
        "Failed to process attendance file. Please check the format and try again, or use Excel import.",
    };
  }
}

/**
 * Resume a failed/uploaded import job without re-uploading the file.
 */
export async function resumeAttendanceImportAction(
  _prev: UploadState,
  formData: FormData
): Promise<UploadState> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!jobId) {
    return { error: "Missing import job id." };
  }

  const started = Date.now();
  try {
    const processResult = await resumeAttendanceImportJob(jobId, session);
    if (processResult.ok) {
      revalidateAttendancePaths();
    }
    return mapProcessResultToState(processResult, { started });
  } catch (e) {
    console.error("Resume import error:", e);
    return {
      error: "Failed to resume import. Please try Continue Import again.",
      jobId,
    };
  }
}

export type ResumableImportJobSummary = {
  id: string;
  fileName: string;
  status: string;
  importedCount: number;
  skippedCount: number;
  nextRowIndex: number;
  totalRows: number;
  errorMessage: string | null;
  updatedAt: string;
};

/** Load recent resumable jobs for the signed-in admin. */
export async function getResumableAttendanceImportJobsAction(): Promise<
  ResumableImportJobSummary[]
> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return [];
  }

  const jobs = await listResumableAttendanceImportJobs(session.id, 5);
  return jobs.map((j) => ({
    id: j.id,
    fileName: j.fileName,
    status: j.status,
    importedCount: j.importedCount,
    skippedCount: j.skippedCount,
    nextRowIndex: j.nextRowIndex,
    totalRows: j.totalRows,
    errorMessage: j.errorMessage,
    updatedAt: j.updatedAt.toISOString(),
  }));
}
