import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import {
  provisionEmployeeLogin,
  UserManagementError,
} from "@/lib/admin/user-management";
import { EXCEL_UPLOAD_DEFAULT_PASSWORD } from "@/lib/admin/account-lifecycle";
import { backfillBiometricPunchesForEmployee } from "@/lib/integrations/biometric-ingestion";
import type { SessionUser } from "@/lib/session";
import { ATTENDANCE_UPLOAD_MAX_ROWS } from "./file-validation";
import { importAttendanceRowBatch } from "./import-batch";
import type { AttendanceImportFormat, AttendanceImportRow } from "./types";

export type ImportAttendanceSuccess = {
  ok: true;
  imported: number;
  skipped: number;
  uploadId: number;
  provisioningErrors: string[];
  rejectedUnknownEmployees: string[];
};

export type ImportAttendanceFailure = {
  ok: false;
  error: string;
};

export type ImportAttendanceResult = ImportAttendanceSuccess | ImportAttendanceFailure;

class ImportAbortError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string) {
    super(userMessage);
    this.name = "ImportAbortError";
    this.userMessage = userMessage;
  }
}

/**
 * Shared attendance import (Excel + PDF): atomic DB write via interactive transaction.
 * Unknown employee codes are auto-created for both Excel and PDF, then login is
 * provisioned after commit as `{code}@zebl.com` with the default upload password (soft-fail).
 *
 * Date resolution (sole fallback site):
 *   attendanceDate = row.attendanceDate ?? formAttendanceDate
 *
 * Prefer `processAttendanceImportJob` for large uploads (chunked + resumable).
 */
export async function importAttendanceRows(params: {
  session: SessionUser;
  fileName: string;
  /** Upload-form date — used when a row does not supply `attendanceDate`. */
  attendanceDate: Date;
  rows: AttendanceImportRow[];
  source: AttendanceImportFormat;
}): Promise<ImportAttendanceResult> {
  const { session, fileName, attendanceDate: formAttendanceDate, rows, source } = params;

  if (rows.length > ATTENDANCE_UPLOAD_MAX_ROWS) {
    return {
      ok: false,
      error: `File contains ${rows.length} rows. Maximum allowed per upload is ${ATTENDANCE_UPLOAD_MAX_ROWS} rows.`,
    };
  }

  const requestContext = await getRequestSecurityContext();

  try {
    const txResult = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const rejectedUnknownEmployees: string[] = [];

        const upload = await tx.attendanceUpload.create({
          data: {
            fileName,
            uploadedBy: session.email,
            recordCount: 0,
          },
        });

        const batch = await importAttendanceRowBatch(tx, {
          rows,
          formAttendanceDate,
          uploadId: upload.id,
        });

        if (batch.imported === 0 && batch.skipped === 0 && rows.length > 0) {
          throw new ImportAbortError("No attendance records were imported.");
        }

        await tx.attendanceUpload.update({
          where: { id: upload.id },
          data: { recordCount: batch.imported },
        });

        await writeAuditLog(
          {
            entityType: "attendance_upload",
            entityId: String(upload.id),
            action: AUDIT_ACTIONS.ATTENDANCE_UPLOAD_COMPLETED,
            actorUserId: session.id,
            actorEmail: session.email,
            employeeId: session.employeeId,
            module: "attendance",
            description: "Attendance workbook import completed.",
            requestContext,
            metadata: {
              formAttendanceDate: formAttendanceDate.toISOString(),
              attendanceDate: formAttendanceDate.toISOString(),
              fileName,
              imported: batch.imported,
              skipped: batch.skipped,
              source,
              rejectedUnknownEmployees,
            },
          },
          tx
        );

        return {
          imported: batch.imported,
          skipped: batch.skipped,
          uploadId: upload.id,
          rejectedUnknownEmployees,
          newEmployees: batch.newEmployees,
        };
      },
      {
        maxWait: 20_000,
        timeout: 120_000,
      }
    );

    const provisioningErrors: string[] = [];
    for (const created of txResult.newEmployees) {
      try {
        await backfillBiometricPunchesForEmployee(created.id, created.employeeCode);
      } catch (error) {
        console.error("Failed to backfill biometric punches for new employee:", error);
      }

      const email = `${created.employeeCode.toLowerCase()}@zebl.com`;
      try {
        const provisioned = await provisionEmployeeLogin(session, {
          employeeId: created.id,
          mode: "create",
          email,
          password: EXCEL_UPLOAD_DEFAULT_PASSWORD,
          generate: false,
          mustChangePassword: true,
          auditOperation: "upload_auto_create",
        });
        await prisma.notificationPreference.create({
          data: { userId: provisioned.userId },
        });
      } catch (error) {
        const message =
          error instanceof UserManagementError
            ? error.message
            : "Login provisioning failed.";
        provisioningErrors.push(`${created.employeeCode}: ${message}`);
      }
    }

    return {
      ok: true,
      imported: txResult.imported,
      skipped: txResult.skipped,
      uploadId: txResult.uploadId,
      provisioningErrors,
      rejectedUnknownEmployees: txResult.rejectedUnknownEmployees,
    };
  } catch (error) {
    if (error instanceof ImportAbortError) {
      return { ok: false, error: error.userMessage };
    }
    console.error("Attendance import database error:", error);
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    if (code === "P2028") {
      return {
        ok: false,
        error:
          "Import timed out while writing to the database. Please try again — large files with many new employees can take longer on the first import.",
      };
    }
    return { ok: false, error: "Import failed due to a database error. Please try again." };
  }
}
