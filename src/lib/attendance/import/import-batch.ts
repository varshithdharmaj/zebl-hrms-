/**
 * Shared batch import for a slice of attendance rows inside an open transaction.
 * Preserves auto-create, duplicate skip, and saveAttendanceRecord behavior.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AttendanceImportRow } from "./types";
import { resolveImportAttendanceDate } from "./types";
import { formatTimeCell } from "./cell-utils";
import { deriveAttendanceStatus, parseDurationToMinutes, parseOTToMinutes } from "@/lib/attendance";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type NewEmployeeRef = { id: number; employeeCode: string };

export type ImportBatchResult = {
  imported: number;
  skipped: number;
  newEmployees: NewEmployeeRef[];
};

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
 * Import a contiguous slice of rows using an existing transaction client.
 * Does not create AttendanceUpload or write audit logs.
 */
export async function importAttendanceRowBatch(
  tx: Prisma.TransactionClient,
  params: {
    rows: AttendanceImportRow[];
    formAttendanceDate: Date;
    uploadId: number;
  }
): Promise<ImportBatchResult> {
  let imported = 0;
  let skipped = 0;
  const newEmployees: NewEmployeeRef[] = [];

  for (const row of params.rows) {
    const employeeCode = row.employeeCode;
    const employeeName = row.employeeName;
    const attendanceDate = resolveImportAttendanceDate(row, params.formAttendanceDate);

    const employee = await tx.employee.findUnique({
      where: { employeeCode },
    });

    if (!employee) {
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
        uploadId: params.uploadId,
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
      uploadId: params.uploadId,
      attendanceDate,
      row,
    });
    imported++;
  }

  return { imported, skipped, newEmployees };
}
