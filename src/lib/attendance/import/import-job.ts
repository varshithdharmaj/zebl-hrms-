import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import {
  provisionEmployeeLogin,
  UserManagementError,
} from "@/lib/admin/user-management";
import { EXCEL_UPLOAD_DEFAULT_PASSWORD } from "@/lib/admin/account-lifecycle";
import type { SessionUser } from "@/lib/session";
import { startOfDay } from "@/lib/utils";
import { ATTENDANCE_UPLOAD_MAX_ROWS } from "./file-validation";
import { importAttendanceRowBatch, type NewEmployeeRef, type SkippedImportRow } from "./import-batch";
import { ensureAttendanceImportJobSchema } from "./ensure-import-job-schema";
import {
  ATTENDANCE_IMPORT_PARSER_VERSION,
  IMPORT_CHUNK_SIZE,
  compressPayload,
  decompressPayload,
} from "./import-job-payload";
import type { AttendanceImportFormat, AttendanceImportRow, AttendanceReportType } from "./types";

export type CreateAttendanceImportJobInput = {
  session: SessionUser;
  fileName: string;
  source: AttendanceImportFormat;
  reportType?: AttendanceReportType;
  formAttendanceDate: Date;
  rows: AttendanceImportRow[];
};

export type ProcessAttendanceImportJobSuccess = {
  ok: true;
  jobId: string;
  status: "COMPLETED";
  imported: number;
  skipped: number;
  employeesCreated: number;
  usersCreated: number;
  provisioningErrors: string[];
  nextRowIndex: number;
  totalRows: number;
  skippedRows: SkippedImportRow[];
};

export type ProcessAttendanceImportJobFailure = {
  ok: false;
  jobId: string;
  status: "UPLOADED" | "PROCESSING" | "FAILED" | "COMPLETED" | "CANCELLED";
  error: string;
  imported: number;
  skipped: number;
  employeesCreated: number;
  usersCreated: number;
  nextRowIndex: number;
  totalRows: number;
  provisioningErrors: string[];
  skippedRows: SkippedImportRow[];
};

export type ProcessAttendanceImportJobResult =
  | ProcessAttendanceImportJobSuccess
  | ProcessAttendanceImportJobFailure;

/** Cap skipped row details returned to the client (full count still in `skipped`). */
const MAX_SKIPPED_DETAILS = 200;

function emptySkipped(): SkippedImportRow[] {
  return [];
}

function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }
  return "";
}

function formatProcessError(error: unknown): string {
  const code = prismaErrorCode(error);
  if (code === "P2028") {
    return "Import timed out while writing a chunk. Click Continue Import to resume without re-uploading.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Import failed due to a database error. Click Continue Import to resume without re-uploading.";
}

/**
 * Persist parsed rows as a resumable import job (compressed payload).
 */
export async function createAttendanceImportJob(
  input: CreateAttendanceImportJobInput
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  if (input.rows.length === 0) {
    return { ok: false, error: "No attendance rows were found in the file." };
  }
  if (input.rows.length > ATTENDANCE_UPLOAD_MAX_ROWS) {
    return {
      ok: false,
      error: `File contains ${input.rows.length} rows. Maximum allowed per upload is ${ATTENDANCE_UPLOAD_MAX_ROWS} rows.`,
    };
  }

  await ensureAttendanceImportJobSchema();

  const payloadCompressed = compressPayload(input.rows);
  const job = await prisma.attendanceImportJob.create({
    data: {
      createdByUserId: input.session.id,
      status: "UPLOADED",
      fileName: input.fileName,
      source: input.source,
      reportType: input.reportType ?? null,
      formAttendanceDate: startOfDay(input.formAttendanceDate),
      totalRows: input.rows.length,
      nextRowIndex: 0,
      payloadCompressed,
      parserVersion: ATTENDANCE_IMPORT_PARSER_VERSION,
    },
  });

  return { ok: true, jobId: job.id };
}

async function provisionNewEmployees(
  session: SessionUser,
  newEmployees: NewEmployeeRef[]
): Promise<{ usersCreated: number; provisioningErrors: string[] }> {
  const provisioningErrors: string[] = [];
  let usersCreated = 0;

  for (const created of newEmployees) {
    const email = `${created.employeeCode.toLowerCase()}@zebl.com`;
    try {
      const provisioned = await provisionEmployeeLogin(session, {
        employeeId: created.id,
        mode: "create",
        email,
        password: EXCEL_UPLOAD_DEFAULT_PASSWORD,
        generate: false,
        mustChangePassword: false,
        auditOperation: "upload_auto_create",
      });
      await prisma.notificationPreference.create({
        data: { userId: provisioned.userId },
      });
      usersCreated++;
    } catch (error) {
      const message =
        error instanceof UserManagementError
          ? error.message
          : "Login provisioning failed.";
      provisioningErrors.push(`${created.employeeCode}: ${message}`);
    }
  }

  return { usersCreated, provisioningErrors };
}

/**
 * Process (or continue) a job from nextRowIndex in IMPORT_CHUNK_SIZE transactions.
 */
export async function processAttendanceImportJob(
  jobId: string,
  session: SessionUser
): Promise<ProcessAttendanceImportJobResult> {
  await ensureAttendanceImportJobSchema();

  const job = await prisma.attendanceImportJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return {
      ok: false,
      jobId,
      status: "FAILED",
      error: "Import job not found.",
      imported: 0,
      skipped: 0,
      employeesCreated: 0,
      usersCreated: 0,
      nextRowIndex: 0,
      totalRows: 0,
      provisioningErrors: [],
      skippedRows: emptySkipped(),
    };
  }

  if (job.createdByUserId !== session.id) {
    return {
      ok: false,
      jobId,
      status: job.status,
      error: "You do not have access to this import job.",
      imported: job.importedCount,
      skipped: job.skippedCount,
      employeesCreated: job.employeesCreated,
      usersCreated: job.usersCreated,
      nextRowIndex: job.nextRowIndex,
      totalRows: job.totalRows,
      provisioningErrors: [],
      skippedRows: emptySkipped(),
    };
  }

  if (job.status === "COMPLETED") {
    return {
      ok: true,
      jobId,
      status: "COMPLETED",
      imported: job.importedCount,
      skipped: job.skippedCount,
      employeesCreated: job.employeesCreated,
      usersCreated: job.usersCreated,
      provisioningErrors: [],
      nextRowIndex: job.nextRowIndex,
      totalRows: job.totalRows,
      skippedRows: emptySkipped(),
    };
  }

  if (job.status === "CANCELLED") {
    return {
      ok: false,
      jobId,
      status: "CANCELLED",
      error: "This import job was cancelled.",
      imported: job.importedCount,
      skipped: job.skippedCount,
      employeesCreated: job.employeesCreated,
      usersCreated: job.usersCreated,
      nextRowIndex: job.nextRowIndex,
      totalRows: job.totalRows,
      provisioningErrors: [],
      skippedRows: emptySkipped(),
    };
  }

  if (job.status === "PROCESSING") {
    return {
      ok: false,
      jobId,
      status: "PROCESSING",
      error: "Job already processing",
      imported: job.importedCount,
      skipped: job.skippedCount,
      employeesCreated: job.employeesCreated,
      usersCreated: job.usersCreated,
      nextRowIndex: job.nextRowIndex,
      totalRows: job.totalRows,
      provisioningErrors: [],
      skippedRows: emptySkipped(),
    };
  }

  // Optimistic lock: only UPLOADED or FAILED may enter PROCESSING
  const claimed = await prisma.attendanceImportJob.updateMany({
    where: {
      id: jobId,
      createdByUserId: session.id,
      status: { in: ["UPLOADED", "FAILED"] },
    },
    data: {
      status: "PROCESSING",
      startedAt: job.startedAt ?? new Date(),
      errorMessage: null,
    },
  });

  if (claimed.count === 0) {
    return {
      ok: false,
      jobId,
      status: "PROCESSING",
      error: "Job already processing",
      imported: job.importedCount,
      skipped: job.skippedCount,
      employeesCreated: job.employeesCreated,
      usersCreated: job.usersCreated,
      nextRowIndex: job.nextRowIndex,
      totalRows: job.totalRows,
      provisioningErrors: [],
      skippedRows: emptySkipped(),
    };
  }

  const rows = decompressPayload(job.payloadCompressed);
  const formAttendanceDate = startOfDay(job.formAttendanceDate ?? new Date());
  const requestContext = await getRequestSecurityContext();

  let nextRowIndex = job.nextRowIndex;
  let importedCount = job.importedCount;
  let skippedCount = job.skippedCount;
  let employeesCreated = job.employeesCreated;
  let usersCreated = job.usersCreated;
  let warningsCount = job.warningsCount;
  const runNewEmployees: NewEmployeeRef[] = [];
  const runSkippedRows: SkippedImportRow[] = [];
  let uploadId: number | null = null;

  try {
    const upload = await prisma.attendanceUpload.create({
      data: {
        fileName: job.fileName,
        uploadedBy: session.email,
        recordCount: 0,
      },
    });
    uploadId = upload.id;

    while (nextRowIndex < job.totalRows) {
      const slice = rows.slice(nextRowIndex, nextRowIndex + IMPORT_CHUNK_SIZE);
      if (slice.length === 0) break;

      const batch = await prisma.$transaction(
        async (tx) =>
          importAttendanceRowBatch(tx, {
            rows: slice,
            formAttendanceDate,
            uploadId: upload.id,
          }),
        {
          maxWait: 15_000,
          timeout: 60_000,
        }
      );

      nextRowIndex += slice.length;
      importedCount += batch.imported;
      skippedCount += batch.skipped;
      employeesCreated += batch.newEmployees.length;
      runNewEmployees.push(...batch.newEmployees);
      if (runSkippedRows.length < MAX_SKIPPED_DETAILS) {
        const room = MAX_SKIPPED_DETAILS - runSkippedRows.length;
        runSkippedRows.push(...batch.skippedRows.slice(0, room));
      }

      await prisma.attendanceImportJob.update({
        where: { id: jobId },
        data: {
          nextRowIndex,
          importedCount,
          skippedCount,
          employeesCreated,
        },
      });
    }

    await prisma.attendanceUpload.update({
      where: { id: upload.id },
      data: { recordCount: importedCount },
    });

    await writeAuditLog({
      entityType: "attendance_upload",
      entityId: String(upload.id),
      action: AUDIT_ACTIONS.ATTENDANCE_UPLOAD_COMPLETED,
      actorUserId: session.id,
      actorEmail: session.email,
      employeeId: session.employeeId,
      module: "attendance",
      description: "Attendance import job completed.",
      requestContext,
      metadata: {
        jobId,
        formAttendanceDate: formAttendanceDate.toISOString(),
        fileName: job.fileName,
        imported: importedCount,
        skipped: skippedCount,
        source: job.source,
      },
    });

    const provisioned = await provisionNewEmployees(session, runNewEmployees);
    usersCreated += provisioned.usersCreated;
    warningsCount += provisioned.provisioningErrors.length;

    await prisma.attendanceImportJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        nextRowIndex,
        importedCount,
        skippedCount,
        employeesCreated,
        usersCreated,
        warningsCount,
        errorMessage: null,
      },
    });

    return {
      ok: true,
      jobId,
      status: "COMPLETED",
      imported: importedCount,
      skipped: skippedCount,
      employeesCreated,
      usersCreated,
      provisioningErrors: provisioned.provisioningErrors,
      nextRowIndex,
      totalRows: job.totalRows,
      skippedRows: runSkippedRows,
    };
  } catch (error) {
    console.error("Attendance import job process error:", error);
    const errorMessage = formatProcessError(error);

    // Soft-provision employees created in committed chunks before failure
    const provisioned = await provisionNewEmployees(session, runNewEmployees);
    usersCreated += provisioned.usersCreated;
    warningsCount += provisioned.provisioningErrors.length;

    if (uploadId !== null) {
      try {
        await prisma.attendanceUpload.update({
          where: { id: uploadId },
          data: { recordCount: importedCount },
        });
      } catch {
        // best-effort
      }
    }

    await prisma.attendanceImportJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage,
        errorCount: { increment: 1 },
        nextRowIndex,
        importedCount,
        skippedCount,
        employeesCreated,
        usersCreated,
        warningsCount,
      },
    });

    return {
      ok: false,
      jobId,
      status: "FAILED",
      error: errorMessage,
      imported: importedCount,
      skipped: skippedCount,
      employeesCreated,
      usersCreated,
      nextRowIndex,
      totalRows: job.totalRows,
      provisioningErrors: provisioned.provisioningErrors,
      skippedRows: runSkippedRows,
    };
  }
}

/**
 * Resume a FAILED (or UPLOADED) job from nextRowIndex. Same lock + ownership rules.
 */
export async function resumeAttendanceImportJob(
  jobId: string,
  session: SessionUser
): Promise<ProcessAttendanceImportJobResult> {
  return processAttendanceImportJob(jobId, session);
}

/**
 * Recent resumable jobs for the current admin (failed / uploaded only).
 */
export async function listResumableAttendanceImportJobs(
  userId: string,
  limit = 5
): Promise<
  Array<{
    id: string;
    fileName: string;
    status: string;
    importedCount: number;
    skippedCount: number;
    nextRowIndex: number;
    totalRows: number;
    errorMessage: string | null;
    updatedAt: Date;
  }>
> {
  await ensureAttendanceImportJobSchema();

  const jobs = await prisma.attendanceImportJob.findMany({
    where: {
      createdByUserId: userId,
      status: { in: ["FAILED", "UPLOADED"] },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      fileName: true,
      status: true,
      importedCount: true,
      skippedCount: true,
      nextRowIndex: true,
      totalRows: true,
      errorMessage: true,
      updatedAt: true,
    },
  });
  return jobs;
}
