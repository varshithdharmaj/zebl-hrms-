import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { deriveAttendanceStatus, parseDurationToMinutes, parseOTToMinutes } from "@/lib/attendance";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import {
  provisionEmployeeLogin,
  UserManagementError,
} from "@/lib/admin/user-management";
import type { SessionUser } from "@/lib/session";
import { formatTimeCell } from "./cell-utils";
import { ATTENDANCE_UPLOAD_MAX_ROWS } from "./file-validation";
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

type DbClient = Prisma.TransactionClient | typeof prisma;

class ImportAbortError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string) {
    super(userMessage);
    this.name = "ImportAbortError";
    this.userMessage = userMessage;
  }
}

async function saveAttendanceRecord(
  client: DbClient,
  params: {
    employeeId: number;
    uploadId: number;
    attendanceDate: Date;
    row: AttendanceImportRow;
  }
): Promise<void> {
  const { employeeId, uploadId, attendanceDate, row } = params;
  const checkIn = formatTimeCell(row.inTime);
  const checkOut = formatTimeCell(row.outTime);
  const workDuration = row.workDuration;

  let workedMinutes = parseDurationToMinutes(workDuration);
  if (workedMinutes === 0 && checkIn && checkOut) {
    const inParts = checkIn.split(":").map(Number);
    const outParts = checkOut.split(":").map(Number);
    if (inParts.length >= 2 && outParts.length >= 2) {
      const inMins = inParts[0] * 60 + inParts[1];
      const outMins = outParts[0] * 60 + outParts[1];
      workedMinutes = outMins >= inMins ? outMins - inMins : 24 * 60 - inMins + outMins;
    }
  }

  const overtimeMinutes = parseOTToMinutes(row.ot);
  const status = deriveAttendanceStatus(checkIn, workedMinutes);
  const remarks = row.remarks || row.status || null;

  const created = await client.attendanceRecord.create({
    data: {
      employeeId,
      uploadId,
      attendanceDate,
      shift: row.shift || null,
      checkIn,
      checkOut,
      workDuration: workDuration || null,
      workedMinutes,
      overtimeMinutes,
      status,
      remarks,
    },
  });

  if (checkIn) {
    await client.attendanceSession.create({
      data: {
        attendanceId: created.id,
        checkIn,
        checkOut,
        workedMinutes,
      },
    });
  }
}

/**
 * Shared attendance import (Excel + PDF): atomic DB write via interactive transaction.
 * Excel may auto-create employees; PDF rejects unknown employee codes (no create / no login).
 * Login provisioning for Excel auto-created employees runs after a successful commit (soft-fail).
 */
export async function importAttendanceRows(params: {
  session: SessionUser;
  fileName: string;
  attendanceDate: Date;
  rows: AttendanceImportRow[];
  source: AttendanceImportFormat;
}): Promise<ImportAttendanceResult> {
  const { session, fileName, attendanceDate, rows, source } = params;

  if (rows.length > ATTENDANCE_UPLOAD_MAX_ROWS) {
    return {
      ok: false,
      error: `File contains ${rows.length} rows. Maximum allowed per upload is ${ATTENDANCE_UPLOAD_MAX_ROWS} rows.`,
    };
  }

  const requestContext = await getRequestSecurityContext();

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      let imported = 0;
      let skipped = 0;
      const rejectedUnknownEmployees: string[] = [];
      const newEmployees: { id: number; employeeCode: string }[] = [];

      const upload = await tx.attendanceUpload.create({
        data: {
          fileName,
          uploadedBy: session.email,
          recordCount: 0,
        },
      });

      for (const row of rows) {
        const employeeCode = row.employeeCode;
        const employeeName = row.employeeName;

        const employee = await tx.employee.findUnique({
          where: { employeeCode },
        });

        if (!employee) {
          if (source === "pdf") {
            rejectedUnknownEmployees.push(employeeCode);
            continue;
          }

          const created = await tx.employee.create({
            data: {
              employeeCode,
              name: employeeName || employeeCode,
              shift: row.shift || null,
            },
          });
          newEmployees.push({ id: created.id, employeeCode });

          await saveAttendanceRecord(tx, {
            employeeId: created.id,
            uploadId: upload.id,
            attendanceDate,
            row,
          });
          imported++;
          continue;
        }

        const existing = await tx.attendanceRecord.findUnique({
          where: {
            employeeId_attendanceDate: {
              employeeId: employee.id,
              attendanceDate,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await saveAttendanceRecord(tx, {
          employeeId: employee.id,
          uploadId: upload.id,
          attendanceDate,
          row,
        });
        imported++;
      }

      if (imported === 0 && skipped === 0 && rejectedUnknownEmployees.length > 0) {
        throw new ImportAbortError(
          `No matching employees found for PDF import. Unknown employee code(s): ${rejectedUnknownEmployees.slice(0, 5).join(", ")}${rejectedUnknownEmployees.length > 5 ? "…" : ""}. PDF import does not create employees — add them first or use Excel import.`
        );
      }

      if (imported === 0 && skipped === 0 && rows.length > 0) {
        throw new ImportAbortError("No attendance records were imported.");
      }

      await tx.attendanceUpload.update({
        where: { id: upload.id },
        data: { recordCount: imported },
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
            attendanceDate: attendanceDate.toISOString(),
            fileName,
            imported,
            skipped,
            source,
            rejectedUnknownEmployees,
          },
        },
        tx
      );

      return {
        imported,
        skipped,
        uploadId: upload.id,
        rejectedUnknownEmployees,
        newEmployees,
      };
    });

    const provisioningErrors: string[] = [];
    for (const created of txResult.newEmployees) {
      const email = `${created.employeeCode.toLowerCase()}@zebl.com`;
      try {
        const provisioned = await provisionEmployeeLogin(session, {
          employeeId: created.id,
          mode: "create",
          email,
          generate: true,
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
    return { ok: false, error: "Import failed due to a database error. Please try again." };
  }
}
