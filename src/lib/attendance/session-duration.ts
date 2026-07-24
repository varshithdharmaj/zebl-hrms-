/**
 * Pure duration helpers for attendance sessions.
 * Reuses project conventions: HH:MM strings, overnight wrap when out < in.
 */

export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "na") return null;

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

/** Completed session duration. Supports overnight when checkOut < checkIn. */
export function sessionDurationMinutes(
  checkIn: string,
  checkOut: string | null | undefined
): number {
  if (!checkOut) return 0;
  const inMins = parseTimeToMinutes(checkIn);
  const outMins = parseTimeToMinutes(checkOut);
  if (inMins === null || outMins === null) return 0;
  return outMins >= inMins ? outMins - inMins : 24 * 60 - inMins + outMins;
}

/** Open-session elapsed minutes from check-in to `asOf` (local clock). */
export function openSessionElapsedMinutes(
  checkIn: string,
  asOf: Date = new Date()
): number {
  const inMins = parseTimeToMinutes(checkIn);
  if (inMins === null) return 0;
  const nowMins = asOf.getHours() * 60 + asOf.getMinutes();
  return nowMins >= inMins ? nowMins - inMins : 24 * 60 - inMins + nowMins;
}

export function formatClockTime(value: string | null | undefined): string {
  if (!value) return "—";
  const mins = parseTimeToMinutes(value);
  if (mins === null) return value.trim();

  const hours24 = Math.floor(mins / 60);
  const minutes = mins % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function currentLocalTimeString(asOf: Date = new Date()): string {
  const h = String(asOf.getHours()).padStart(2, "0");
  const m = String(asOf.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export type SessionLike = {
  checkIn: string;
  checkOut: string | null;
  workedMinutes: number;
};

/**
 * Total worked minutes for a day from sessions.
 * Completed sessions use stored workedMinutes (or recompute); open sessions add live elapsed.
 */
export function totalWorkedMinutesFromSessions(
  sessions: SessionLike[],
  opts?: { includeOpenElapsed?: boolean; asOf?: Date }
): number {
  const includeOpen = opts?.includeOpenElapsed ?? true;
  const asOf = opts?.asOf ?? new Date();

  let total = 0;
  for (const session of sessions) {
    if (session.checkOut) {
      total +=
        session.workedMinutes > 0
          ? session.workedMinutes
          : sessionDurationMinutes(session.checkIn, session.checkOut);
    } else if (includeOpen) {
      total += openSessionElapsedMinutes(session.checkIn, asOf);
    }
  }
  return total;
}
