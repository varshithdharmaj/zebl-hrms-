import type { Prisma } from "@/generated/prisma/client";
import { deriveAttendanceStatus } from "@/lib/attendance";
import {
  sessionDurationMinutes,
  totalWorkedMinutesFromSessions,
} from "@/lib/attendance/session-duration";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "@/lib/utils";

type Tx = Prisma.TransactionClient;

/**
 * Format a Date into its IST date components and time string.
 * Asia/Kolkata (IST) is UTC+5:30.
 */
export function getISTDateParts(date: Date): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  timeString: string; // "HH:MM"
  dateString: string; // "YYYY-MM-DD"
  attendanceDate: Date; // midnight IST local start-of-day Date
} {
  // Use Intl.DateTimeFormat in Asia/Kolkata timezone for 100% environment-independent precision
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = p.value;
    }
  }

  let hourStr = map.hour ?? "00";
  if (hourStr === "24") hourStr = "00";

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const timeString = `${hourStr.padStart(2, "0")}:${(map.minute ?? "00").padStart(2, "0")}`;
  const dateString = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Local startOfDay Date instance for Prisma matching
  const attendanceDate = startOfDay(new Date(year, month - 1, day));

  return {
    year,
    month,
    day,
    timeString,
    dateString,
    attendanceDate,
  };
}

/**
 * Helper to format duration minutes as HH:MM
 */
function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type AffectedEmployeeDateGroup = {
  employeeId: number;
  attendanceDate: Date;
  dateString: string;
};

/**
 * Rebuild AttendanceRecord and AttendanceSession rows for a single employee and attendance date
 * from their full chronological BiometricPunch history.
 *
 * Implements deterministic chronological pairing:
 * Punch 1 -> Check In
 * Punch 2 -> Check Out
 * Punch 3 -> Check In
 * Punch 4 -> Check Out
 * ...
 * Odd punch -> Open Session (checkOut = null)
 *
 * Self-healing: Always processes full punch history for the day, so late punches naturally re-pair.
 * Serialized: Uses PostgreSQL advisory lock to prevent race conditions during concurrent derivation.
 */
export async function deriveAttendanceForEmployeeDate(
  employeeId: number,
  attendanceDate: Date,
  txClient?: Tx
): Promise<void> {
  const runInTransaction = async (tx: Tx) => {
    const dateParts = getISTDateParts(attendanceDate);

    // 1. PostgreSQL advisory lock for serialized concurrency per (employeeId, attendanceDate)
    const lockKey = `biometric_derivation_${employeeId}_${dateParts.dateString}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    // 2. Fetch all BiometricPunch records for this employee on this attendance date
    // Compute IST day range: from 00:00:00 IST to 23:59:59.999 IST (converted to UTC for query)
    const dayStartUtc = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 0, 0, 0) - (5 * 60 + 30) * 60 * 1000);
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

    const punches = await tx.biometricPunch.findMany({
      where: {
        employeeId,
        punchedAt: {
          gte: dayStartUtc,
          lte: dayEndUtc,
        },
      },
      orderBy: [{ punchedAt: "asc" }, { id: "asc" }],
    });

    // Filter punches strictly belonging to this IST attendance date
    const dayPunches = punches.filter(
      (p) => getISTDateParts(p.punchedAt).dateString === dateParts.dateString
    );

    if (dayPunches.length === 0) {
      // If all biometric punches for this date were deleted, remove sessions & record if biometric-derived
      const existingRecord = await tx.attendanceRecord.findUnique({
        where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
      });
      if (existingRecord && existingRecord.remarks === "Biometric Device Ingestion") {
        await tx.attendanceSession.deleteMany({ where: { attendanceId: existingRecord.id } });
        await tx.attendanceRecord.delete({ where: { id: existingRecord.id } });
      }
      return;
    }

    // 3. Find or create AttendanceRecord
    let record = await tx.attendanceRecord.findUnique({
      where: { employeeId_attendanceDate: { employeeId, attendanceDate } },
      select: { id: true, remarks: true },
    });

    if (!record) {
      record = await tx.attendanceRecord.create({
        data: {
          employeeId,
          attendanceDate,
          checkIn: null,
          checkOut: null,
          workedMinutes: 0,
          overtimeMinutes: 0,
          status: "Absent",
          remarks: "Biometric Device Ingestion",
        },
        select: { id: true, remarks: true },
      });
    }

    // 4. Delete existing derived sessions for this record
    await tx.attendanceSession.deleteMany({
      where: { attendanceId: record.id },
    });

    // 5. Chronological pairing of punches
    const sessionDataToCreate: Array<{
      attendanceId: number;
      checkIn: string;
      checkOut: string | null;
      workedMinutes: number;
    }> = [];

    for (let i = 0; i < dayPunches.length; i += 2) {
      const inPunch = dayPunches[i];
      const outPunch = dayPunches[i + 1];

      const checkInTime = getISTDateParts(inPunch.punchedAt).timeString;
      const checkOutTime = outPunch ? getISTDateParts(outPunch.punchedAt).timeString : null;
      const worked = checkOutTime ? sessionDurationMinutes(checkInTime, checkOutTime) : 0;

      sessionDataToCreate.push({
        attendanceId: record.id,
        checkIn: checkInTime,
        checkOut: checkOutTime,
        workedMinutes: worked,
      });
    }

    // 6. Insert new derived sessions
    if (sessionDataToCreate.length > 0) {
      await tx.attendanceSession.createMany({
        data: sessionDataToCreate,
      });
    }

    // 7. Recalculate daily totals and status on AttendanceRecord
    const sessions = await tx.attendanceSession.findMany({
      where: { attendanceId: record.id },
      orderBy: [{ checkIn: "asc" }, { id: "asc" }],
    });

    const completed = sessions.filter((s) => s.checkOut !== null);
    const open = sessions.find((s) => s.checkOut === null);

    const workedMinutes = totalWorkedMinutesFromSessions(sessions, {
      includeOpenElapsed: false,
    });

    const firstCheckIn = sessions[0]?.checkIn ?? null;
    const lastCompletedOut = [...completed].reverse().find((s) => s.checkOut)?.checkOut ?? null;
    const checkOut = open ? null : lastCompletedOut;
    const checkIn = firstCheckIn;
    const status = deriveAttendanceStatus(checkIn, workedMinutes);

    await tx.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkIn,
        checkOut,
        workedMinutes,
        workDuration: durationLabel(workedMinutes),
        status,
        ...(record.remarks === null || record.remarks === "Live check-in"
          ? { remarks: "Biometric Device Ingestion" }
          : {}),
      },
    });
  };

  if (txClient) {
    await runInTransaction(txClient);
  } else {
    await prisma.$transaction(runInTransaction, {
      maxWait: 10000,
      timeout: 30000,
    });
  }
}

/**
 * Batch derivation for multiple affected employee/date groups.
 * Groups by employeeId + attendanceDate to avoid redundant rebuilds.
 */
export async function deriveAttendanceForAffectedGroups(
  groups: AffectedEmployeeDateGroup[]
): Promise<void> {
  if (groups.length === 0) return;

  // Deduplicate employeeId + dateString
  const uniqueGroupsMap = new Map<string, AffectedEmployeeDateGroup>();
  for (const g of groups) {
    const key = `${g.employeeId}_${g.dateString}`;
    if (!uniqueGroupsMap.has(key)) {
      uniqueGroupsMap.set(key, g);
    }
  }

  const uniqueGroups = Array.from(uniqueGroupsMap.values());

  for (const group of uniqueGroups) {
    await deriveAttendanceForEmployeeDate(group.employeeId, group.attendanceDate);
  }
}
