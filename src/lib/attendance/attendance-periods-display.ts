import { formatClockTime } from "@/lib/attendance/session-duration";
import { minutesToHours } from "@/lib/utils";

export type AttendancePeriodSession = {
  id: number;
  checkIn: string;
  checkOut: string | null;
  workedMinutes: number;
  isOpen: boolean;
};

/** Show the periods list only when there are multiple real periods for the day. */
export function shouldShowAttendancePeriods(
  sessions: AttendancePeriodSession[] | null | undefined
): boolean {
  return (sessions?.length ?? 0) > 1;
}

export type AttendancePeriodDisplay = {
  id: number;
  rangeLabel: string;
  durationLabel: string | null;
  isOpen: boolean;
};

export function toAttendancePeriodDisplay(
  session: AttendancePeriodSession
): AttendancePeriodDisplay {
  const checkInLabel = formatClockTime(session.checkIn);
  const checkOutLabel = session.isOpen || !session.checkOut
    ? "In Progress"
    : formatClockTime(session.checkOut);

  return {
    id: session.id,
    rangeLabel: `${checkInLabel} → ${checkOutLabel}`,
    durationLabel:
      session.isOpen || !session.checkOut
        ? null
        : minutesToHours(session.workedMinutes),
    isOpen: session.isOpen || !session.checkOut,
  };
}

export function mapAttendancePeriods(
  sessions: AttendancePeriodSession[]
): AttendancePeriodDisplay[] {
  return sessions.map(toAttendancePeriodDisplay);
}
