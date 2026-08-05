import { describe, expect, it, afterEach, beforeEach } from "vitest";
import {
  attendanceImportConfig,
  isAttendanceImportPreviewEnabled,
} from "@/lib/config/attendance-import";

describe("attendanceImportConfig / ENABLE_ATTENDANCE_IMPORT_PREVIEW", () => {
  const original = process.env.ENABLE_ATTENDANCE_IMPORT_PREVIEW;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ENABLE_ATTENDANCE_IMPORT_PREVIEW;
    } else {
      process.env.ENABLE_ATTENDANCE_IMPORT_PREVIEW = original;
    }
  });

  beforeEach(() => {
    delete process.env.ENABLE_ATTENDANCE_IMPORT_PREVIEW;
  });

  it("defaults to preview disabled", () => {
    expect(isAttendanceImportPreviewEnabled()).toBe(false);
    expect(attendanceImportConfig.previewEnabled).toBe(false);
  });

  it("enables preview for true/1/yes/on", () => {
    for (const value of ["true", "TRUE", "1", "yes", "on"]) {
      process.env.ENABLE_ATTENDANCE_IMPORT_PREVIEW = value;
      expect(isAttendanceImportPreviewEnabled()).toBe(true);
    }
  });

  it("keeps preview disabled for false/empty/other", () => {
    for (const value of ["false", "0", "no", "off", ""]) {
      process.env.ENABLE_ATTENDANCE_IMPORT_PREVIEW = value;
      expect(isAttendanceImportPreviewEnabled()).toBe(false);
    }
  });
});
