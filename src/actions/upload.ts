"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { UserRole, AuthProvider } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guards";
import {
  deriveAttendanceStatus,
  getColumnIndex,
  parseDurationToMinutes,
  parseOTToMinutes,
  validateExcelColumns,
} from "@/lib/attendance";
import { startOfDay } from "@/lib/utils";

export type UploadState = {
  error?: string;
  success?: string;
  imported?: number;
  skipped?: number;
};

function cellValue(row: unknown[], index: number): string {
  if (index < 0) return "";
  const val = row[index];
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function formatTimeCell(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }

  return String(value).trim() || null;
}

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

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
  const MAX_ROWS = 2000; // 2000 rows per file

  if (!file || file.size === 0) {
    return { error: "Please select an Excel file." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "File size exceeds 5MB limit." };
  }

  if (!attendanceDateStr) {
    return { error: "Attendance date is required." };
  }

  const attendanceDate = startOfDay(new Date(attendanceDateStr));
  if (Number.isNaN(attendanceDate.getTime())) {
    return { error: "Invalid attendance date." };
  }

  const validExtensions = [".xlsx", ".xls"];
  const fileName = file.name.toLowerCase();
  if (!validExtensions.some((ext) => fileName.endsWith(ext))) {
    return { error: "Only .xlsx or .xls files are allowed." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return { error: "Excel file has no sheets." };

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

    if (rows.length < 2) {
      return { error: "Excel file has no data rows." };
    }

    const headers = (rows[0] as unknown[]).map((h) => String(h ?? ""));
    const columnError = validateExcelColumns(headers);
    if (columnError) return { error: columnError };

    const idx = {
      code: getColumnIndex(headers, "Employee Code"),
      name: getColumnIndex(headers, "Employee Name"),
      shift: getColumnIndex(headers, "Shift"),
      inTime: getColumnIndex(headers, "In Time"),
      outTime: getColumnIndex(headers, "Out Time"),
      workDuration: getColumnIndex(headers, "Work Duration"),
      ot: getColumnIndex(headers, "OT"),
      status: getColumnIndex(headers, "Status"),
      remarks: getColumnIndex(headers, "Remarks"),
    };

    const dataRows = rows.slice(1).filter((row) => {
      const code = cellValue(row as unknown[], idx.code);
      return code.length > 0;
    });

    if (dataRows.length === 0) {
      return { error: "No valid employee rows found." };
    }

    if (dataRows.length > MAX_ROWS) {
      return { error: `File contains ${dataRows.length} rows. Maximum allowed per upload is ${MAX_ROWS} rows.` };
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    const upload = await prisma.attendanceUpload.create({
      data: {
        fileName: file.name,
        uploadedBy: session.email,
        recordCount: 0,
      },
    });

    for (const row of dataRows) {
      const r = row as unknown[];
      const employeeCode = cellValue(r, idx.code);
      const employeeName = cellValue(r, idx.name);

      const employee = await prisma.employee.findUnique({
        where: { employeeCode },
      });

      if (!employee) {
        const created = await prisma.employee.create({
          data: {
            employeeCode,
            name: employeeName || employeeCode,
            shift: cellValue(r, idx.shift) || null,
          },
        });

        // Auto-create User account with default password "123"
        const defaultPasswordHash = await bcrypt.hash("123", 10);
        const email = `${employeeCode.toLowerCase()}@zebl.com`;
        const newUser = await prisma.user.create({
          data: {
            email,
            password: defaultPasswordHash,
            role: UserRole.employee,
            authProvider: AuthProvider.local,
            employeeId: created.id,
            sessionVersion: 1,
          },
        });

        await prisma.notificationPreference.create({
          data: {
            userId: newUser.id,
          },
        });

        await saveAttendanceRecord({
          employeeId: created.id,
          uploadId: upload.id,
          attendanceDate,
          row: r,
          idx,
        });
        imported++;
        continue;
      }

      const existing = await prisma.attendanceRecord.findUnique({
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

      await saveAttendanceRecord({
        employeeId: employee.id,
        uploadId: upload.id,
        attendanceDate,
        row: r,
        idx,
      });
      imported++;
    }

    await prisma.attendanceUpload.update({
      where: { id: upload.id },
      data: { recordCount: imported },
    });

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/attendance");
    revalidatePath("/admin/payroll-attendance");
    revalidatePath("/admin/upload");

    const message = `Imported ${imported} record(s)${skipped > 0 ? `, skipped ${skipped} duplicate(s)` : ""}.`;
    if (errors.length > 0) {
      return { success: message, imported, skipped, error: errors.slice(0, 3).join("; ") };
    }

    return { success: message, imported, skipped };
  } catch (e) {
    console.error("Upload error:", e);
    return { error: "Failed to process Excel file. Please check the format." };
  }
}

async function saveAttendanceRecord({
  employeeId,
  uploadId,
  attendanceDate,
  row,
  idx,
}: {
  employeeId: number;
  uploadId: number;
  attendanceDate: Date;
  row: unknown[];
  idx: Record<string, number>;
}) {
  const checkIn = formatTimeCell(row[idx.inTime]);
  const checkOut = formatTimeCell(row[idx.outTime]);
  const workDuration = cellValue(row, idx.workDuration);
  const otValue = row[idx.ot] as string | number | null | undefined;

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

  const overtimeMinutes = parseOTToMinutes(otValue);
  const excelStatus = cellValue(row, idx.status);
  const status = deriveAttendanceStatus(checkIn, workedMinutes);
  const remarks = cellValue(row, idx.remarks) || excelStatus || null;

  await prisma.attendanceRecord.create({
    data: {
      employeeId,
      uploadId,
      attendanceDate,
      shift: cellValue(row, idx.shift) || null,
      checkIn,
      checkOut,
      workDuration: workDuration || null,
      workedMinutes,
      overtimeMinutes,
      status,
      remarks,
    },
  });
}
