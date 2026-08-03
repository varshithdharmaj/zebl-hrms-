import { getEnv } from "@/lib/config/env";

/**
 * Attendance import feature flags.
 * Default: preview disabled — Upload → Import directly.
 * Set ENABLE_ATTENDANCE_IMPORT_PREVIEW=true to restore Phase 5 preview → confirm.
 */
export function isAttendanceImportPreviewEnabled(): boolean {
  const raw = getEnv("ENABLE_ATTENDANCE_IMPORT_PREVIEW");
  if (!raw) return false;
  const normalized = raw.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export const attendanceImportConfig = {
  get previewEnabled(): boolean {
    return isAttendanceImportPreviewEnabled();
  },
} as const;
