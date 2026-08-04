/**
 * Shared batch import for a slice of attendance rows inside an open transaction.
 * Prefetches employees + existing attendance to cut round-trips (esp. all-duplicate runs).
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AttendanceImportRow } from "./types";
import { resolveImportAttendanceDate } from "./types";
import { formatTimeCell } from "./cell-utils";
import { deriveAttendanceStatus, parseDurationToMinutes, parseOTToMinutes } from "@/lib/attendance";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type NewEmployeeRef = { id: number; employeeCode: string };

export type SkippedImportRow = {
  employeeCode: string;
  employeeName: string;
  reason: "duplicate";
  attendanceDate: string;
};

export type ImportBatchResult = {
  imported: number;
  skipped: number;
  newEmployees: NewEmployeeRef[];
  skippedRows: SkippedImportRow[];
};

function toIsoDate(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function attendanceKey(employeeId: number, attendanceDate: Date): string {
  return `${employeeId}|${toIsoDate(attendanceDate)}`;
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
  const skippedRows: SkippedImportRow[] = [];

  if (params.rows.length === 0) {
    return { imported, skipped, newEmployees, skippedRows };
  }

  const resolved = params.rows.map((row) => ({
    row,
    attendanceDate: resolveImportAttendanceDate(row, params.formAttendanceDate),
  }));

  const codes = [...new Set(resolved.map((r) => r.row.employeeCode))];
  const existingEmployees = await tx.employee.findMany({
    where: { employeeCode: { in: codes } },
    select: { id: true, employeeCode: true, name: true },
  });
  const employeeByCode = new Map(
    existingEmployees.map((e) => [e.employeeCode, e] as const)
  );

  const employeeIds = existingEmployees.map((e) => e.id);
  const datesByIso = new Map<string, Date>();
  for (const { attendanceDate } of resolved) {
    const iso = toIsoDate(attendanceDate);
    if (!datesByIso.has(iso)) datesByIso.set(iso, attendanceDate);
  }
  const dateValues = [...datesByIso.values()];

  const existingKeys = new Set<string>();
  if (employeeIds.length > 0 && dateValues.length > 0) {
    const existingRecords = await tx.attendanceRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        attendanceDate: { in: dateValues },
      },
      select: { employeeId: true, attendanceDate: true },
    });
    for (const rec of existingRecords) {
      existingKeys.add(attendanceKey(rec.employeeId, rec.attendanceDate));
    }
  }

  for (const { row, attendanceDate } of resolved) {
    const employeeCode = row.employeeCode;
    const employeeName = row.employeeName;
    let employee = employeeByCode.get(employeeCode);

    if (!employee) {
      const created = await tx.employee.create({
        data: {
          employeeCode,
          name: employeeName || employeeCode,
          shift: row.shift || null,
        },
      });
      employee = { id: created.id, employeeCode: created.employeeCode, name: created.name };
      employeeByCode.set(employeeCode, employee);
      newEmployees.push({ id: created.id, employeeCode });

      await saveAttendanceRecord(tx, {
        employeeId: created.id,
        uploadId: params.uploadId,
        attendanceDate,
        row,
      });
      existingKeys.add(attendanceKey(created.id, attendanceDate));
      imported++;
      continue;
    }

    const key = attendanceKey(employee.id, attendanceDate);
    if (existingKeys.has(key)) {
      skipped++;
      skippedRows.push({
        employeeCode,
        employeeName: employeeName || employee.name || employeeCode,
        reason: "duplicate",
        attendanceDate: toIsoDate(attendanceDate),
      });
      continue;
    }

    await saveAttendanceRecord(tx, {
      employeeId: employee.id,
      uploadId: params.uploadId,
      attendanceDate,
      row,
    });
    existingKeys.add(key);
    imported++;
  }

  return { imported, skipped, newEmployees, skippedRows };
}
