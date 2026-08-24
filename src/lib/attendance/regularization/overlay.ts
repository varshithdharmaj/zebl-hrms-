import type { RegularizationRequestType } from "@/generated/prisma/enums";

/**
 * Pure session-list transform for an approved regularisation. Shared by the
 * approval service and the biometric derivation pipeline (§ AttendanceSession
 * consistency) so there is exactly one place that decides how a correction
 * changes a day's sessions — never a second attendance calculation engine.
 *
 * Only the day's boundary sessions are ever touched: the earliest session's
 * checkIn (missing/incorrect_check_in) or the latest session's checkOut
 * (missing/incorrect_check_out). "Full day" types replace the whole list with
 * one synthetic session. Mid-day session corrections (e.g. a wrong lunch-break
 * pair) are out of scope — see isRequestTypeConsistentWithSessions below.
 */

export type OverlaySession = {
  checkIn: string;
  checkOut: string | null;
};

export type OverlayInput = {
  requestType: RegularizationRequestType;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
};

const FULL_DAY_TYPES: RegularizationRequestType[] = [
  "missing_both",
  "attendance_missing",
  "device_failure",
];

export function applyRegularizationOverlay(
  baseSessions: OverlaySession[],
  correction: OverlayInput
): OverlaySession[] {
  const { requestType, requestedCheckIn, requestedCheckOut } = correction;

  if (FULL_DAY_TYPES.includes(requestType)) {
    if (!requestedCheckIn) return [];
    return [{ checkIn: requestedCheckIn, checkOut: requestedCheckOut ?? null }];
  }

  if (requestType === "missing_check_in" || requestType === "incorrect_check_in") {
    if (!requestedCheckIn) return baseSessions;
    if (baseSessions.length === 0) {
      return [{ checkIn: requestedCheckIn, checkOut: null }];
    }
    const [first, ...rest] = baseSessions;
    return [{ ...first, checkIn: requestedCheckIn }, ...rest];
  }

  if (requestType === "missing_check_out" || requestType === "incorrect_check_out") {
    if (!requestedCheckOut) return baseSessions;
    if (baseSessions.length === 0) return baseSessions;
    const last = baseSessions[baseSessions.length - 1];
    return [...baseSessions.slice(0, -1), { ...last, checkOut: requestedCheckOut }];
  }

  return baseSessions;
}

/**
 * Validates that the current (punch-derived) session shape is consistent with
 * what the employee is claiming, so ambiguous/garbled punch days get routed
 * to a full-day override (attendance_missing/device_failure) instead of a
 * boundary correction that could misrepresent real punch data.
 */
export function isRequestTypeConsistentWithSessions(
  requestType: RegularizationRequestType,
  baseSessions: OverlaySession[]
): boolean {
  switch (requestType) {
    case "missing_check_in":
      // Valid only when there is nothing to contradict a "no check-in happened" claim.
      return baseSessions.length === 0;
    case "missing_check_out": {
      if (baseSessions.length === 0) return false;
      const last = baseSessions[baseSessions.length - 1];
      return last.checkOut === null;
    }
    case "incorrect_check_in":
    case "incorrect_check_out":
      return baseSessions.length > 0;
    case "missing_both":
    case "attendance_missing":
    case "device_failure":
      return true;
    default:
      return true;
  }
}
