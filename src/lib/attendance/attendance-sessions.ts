import type { Prisma } from "@/generated/prisma/client";
import { deriveAttendanceStatus } from "@/lib/attendance";
import {
  currentLocalTimeString,
  openSessionElapsedMinutes,
  sessionDurationMinutes,
  totalWorkedMinutesFromSessions,
} from "@/lib/attendance/session-duration";
import { prisma } from "@/lib/prisma";
import { startOfDay, toISODate } from "@/lib/utils";

export type AttendanceSessionDto = {
  id: number;
  checkIn: string;
  checkOut: string | null;
  workedMinutes: number;
  isOpen: boolean;
};

export type DaySessionsResult = {
  attendanceId: number | null;
  sessions: AttendanceSessionDto[];
  totalWorkedMinutes: number;
  hasOpenSession: boolean;
  /** Legacy fields still used by payroll / hero classification */
  checkIn: string | null;
  checkOut: string | null;
  status: string;
};

type Tx = Prisma.TransactionClient;

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function mapSession(s: {
  id: number;
  checkIn: string;
  checkOut: string | null;
  workedMinutes: number;
}): AttendanceSessionDto {
  return {
    id: s.id,
    checkIn: s.checkIn,
    checkOut: s.checkOut,
    workedMinutes: s.workedMinutes,
    isOpen: s.checkOut === null,
  };
}

/**
 * Sync daily AttendanceRecord aggregate fields from its sessions.
 * Preserves overtimeMinutes (upload / payroll source of truth).
 * Open-session elapsed is not persisted — only completed session minutes.
 */
export async function recalculateDailyAttendanceTotals(
  attendanceId: number,
  tx: Tx = prisma
): Promise<void> {
  const sessions = await tx.attendanceSession.findMany({
    where: { attendanceId },
    orderBy: [{ checkIn: "asc" }, { id: "asc" }],
  });

  const completed = sessions.filter((s) => s.checkOut !== null);
  const open = sessions.find((s) => s.checkOut === null);

  const workedMinutes = totalWorkedMinutesFromSessions(sessions, {
    includeOpenElapsed: false,
  });

  const firstCheckIn = sessions[0]?.checkIn ?? null;
  const lastCompletedOut =
    [...completed].reverse().find((s) => s.checkOut)?.checkOut ?? null;
  const checkOut = open ? null : lastCompletedOut;
  const checkIn = firstCheckIn;
  const status = deriveAttendanceStatus(checkIn, workedMinutes);

  await tx.attendanceRecord.update({
    where: { id: attendanceId },
    data: {
      checkIn,
      checkOut,
      workedMinutes,
      workDuration: durationLabel(workedMinutes),
      status,
    },
  });
}

async function getOrCreateTodayRecord(
  employeeId: number,
  tx: Tx,
  attendanceDate: Date = startOfDay()
): Promise<{ id: number }> {
  const existing = await tx.attendanceRecord.findUnique({
    where: {
      employeeId_attendanceDate: { employeeId, attendanceDate },
    },
    select: { id: true },
  });
  if (existing) return existing;

  return tx.attendanceRecord.create({
    data: {
      employeeId,
      attendanceDate,
      checkIn: null,
      checkOut: null,
      workedMinutes: 0,
      overtimeMinutes: 0,
      status: "Absent",
      remarks: "Live check-in",
    },
    select: { id: true },
  });
}

export type SessionActionError =
  | "ALREADY_CHECKED_IN"
  | "NO_OPEN_SESSION"
  | "UNAUTHORIZED"
  | "FAILED";

export type SessionActionResult =
  | { ok: true; attendanceId: number; sessionId: number }
  | { ok: false; error: SessionActionError; message: string };

/** Open a new attendance period for the employee/date. Rejects if one is already open. */
export async function checkInEmployeeSession(
  employeeId: number,
  asOf: Date = new Date()
): Promise<SessionActionResult> {
  const checkIn = currentLocalTimeString(asOf);
  const attendanceDate = startOfDay(asOf);

  try {
    return await prisma.$transaction(async (tx) => {
      const record = await getOrCreateTodayRecord(employeeId, tx, attendanceDate);

      const open = await tx.attendanceSession.findFirst({
        where: { attendanceId: record.id, checkOut: null },
        select: { id: true },
      });
      if (open) {
        return {
          ok: false as const,
          error: "ALREADY_CHECKED_IN" as const,
          message:
            "You already have an active check-in. Check out before starting a new session.",
        };
      }

      const session = await tx.attendanceSession.create({
        data: {
          attendanceId: record.id,
          checkIn,
          checkOut: null,
          workedMinutes: 0,
        },
      });

      await recalculateDailyAttendanceTotals(record.id, tx);

      return {
        ok: true as const,
        attendanceId: record.id,
        sessionId: session.id,
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("attendance_sessions_one_open_per_day_idx")) {
      return {
        ok: false,
        error: "ALREADY_CHECKED_IN",
        message:
          "You already have an active check-in. Check out before starting a new session.",
      };
    }
    console.error("[attendance-sessions] check-in failed:", e);
    return { ok: false, error: "FAILED", message: "Could not check in. Please try again." };
  }
}

/** Close the currently open attendance period. Rejects if none is open. */
export async function checkOutEmployeeSession(
  employeeId: number,
  asOf: Date = new Date()
): Promise<SessionActionResult> {
  const checkOut = currentLocalTimeString(asOf);
  const attendanceDate = startOfDay(asOf);

  try {
    return await prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRecord.findUnique({
        where: {
          employeeId_attendanceDate: { employeeId, attendanceDate },
        },
        select: { id: true },
      });

      if (!record) {
        return {
          ok: false as const,
          error: "NO_OPEN_SESSION" as const,
          message: "No attendance record for today. Check in first.",
        };
      }

      const open = await tx.attendanceSession.findFirst({
        where: { attendanceId: record.id, checkOut: null },
        orderBy: { createdAt: "desc" },
      });

      if (!open) {
        return {
          ok: false as const,
          error: "NO_OPEN_SESSION" as const,
          message: "No active check-in to close. Check in first.",
        };
      }

      const workedMinutes = sessionDurationMinutes(open.checkIn, checkOut);

      await tx.attendanceSession.update({
        where: { id: open.id },
        data: { checkOut, workedMinutes },
      });

      await recalculateDailyAttendanceTotals(record.id, tx);

      return {
        ok: true as const,
        attendanceId: record.id,
        sessionId: open.id,
      };
    });
  } catch (e) {
    console.error("[attendance-sessions] check-out failed:", e);
    return { ok: false, error: "FAILED", message: "Could not check out. Please try again." };
  }
}

/**
 * Ensure a legacy daily record has at least one session (upload / backfill helper).
 * Idempotent: no-ops if sessions already exist.
 */
export async function ensureLegacySessionForRecord(
  attendanceId: number,
  fields: {
    checkIn: string | null;
    checkOut: string | null;
    workedMinutes: number;
  },
  tx: Tx = prisma
): Promise<void> {
  if (!fields.checkIn) return;

  const existing = await tx.attendanceSession.count({ where: { attendanceId } });
  if (existing > 0) return;

  const worked =
    fields.checkOut && fields.workedMinutes > 0
      ? fields.workedMinutes
      : sessionDurationMinutes(fields.checkIn, fields.checkOut);

  await tx.attendanceSession.create({
    data: {
      attendanceId,
      checkIn: fields.checkIn,
      checkOut: fields.checkOut,
      workedMinutes: worked,
    },
  });
}

export async function getDaySessionsForEmployee(
  employeeId: number,
  date: Date = startOfDay(),
  opts?: { asOf?: Date }
): Promise<DaySessionsResult> {
  const asOf = opts?.asOf ?? new Date();
  const dayStart = startOfDay(date);
  const dayEnd = startOfDay(
    new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1)
  );

  const record = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId,
      attendanceDate: { gte: dayStart, lt: dayEnd },
    },
    include: {
      sessions: { orderBy: [{ checkIn: "asc" }, { id: "asc" }] },
    },
  });

  if (!record) {
    return {
      attendanceId: null,
      sessions: [],
      totalWorkedMinutes: 0,
      hasOpenSession: false,
      checkIn: null,
      checkOut: null,
      status: "No Record",
    };
  }

  let sessions = record.sessions.map(mapSession);

  if (sessions.length === 0 && record.checkIn) {
    sessions = [
      {
        id: 0,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
        workedMinutes: record.workedMinutes,
        isOpen: record.checkOut === null,
      },
    ];
  }

  const hasOpenSession = sessions.some((s) => s.isOpen);
  const totalWorkedMinutes =
    sessions.length > 0
      ? totalWorkedMinutesFromSessions(
          sessions.map((s) => ({
            checkIn: s.checkIn,
            checkOut: s.checkOut,
            workedMinutes: s.isOpen
              ? openSessionElapsedMinutes(s.checkIn, asOf)
              : s.workedMinutes,
          })),
          { includeOpenElapsed: true, asOf }
        )
      : record.workedMinutes;

  return {
    attendanceId: record.id,
    sessions,
    totalWorkedMinutes,
    hasOpenSession,
    checkIn: record.checkIn,
    checkOut: record.checkOut,
    status: record.status,
  };
}

export function describeDaySessions(result: DaySessionsResult): string {
  return `${toISODate(startOfDay())}: ${result.sessions.length} session(s), ${result.totalWorkedMinutes}m`;
}
