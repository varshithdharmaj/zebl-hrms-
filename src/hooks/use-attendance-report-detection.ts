"use client";

import { useEffect, useState } from "react";
import {
  detectAttendanceReportMetadataAction,
  type DetectAttendanceReportState,
} from "@/actions/detect-attendance-report";
import { buildAttendanceReportMetadata } from "@/lib/attendance/import/report-metadata";
import type { AttendanceReportMetadata } from "@/lib/attendance/import/report-metadata";

export type AttendanceReportDetectionStatus =
  | "idle"
  | "detecting"
  | "ready"
  | "error";

export type AttendanceReportDetectionState = {
  status: AttendanceReportDetectionStatus;
  metadata: AttendanceReportMetadata | null;
  error: string | null;
};

const IDLE: AttendanceReportDetectionState = {
  status: "idle",
  metadata: null,
  error: null,
};

/**
 * Detect report type once per selected file for upload UX.
 * Resets when the file is cleared or replaced.
 */
export function useAttendanceReportDetection(
  file: File | null
): AttendanceReportDetectionState {
  const [state, setState] = useState<AttendanceReportDetectionState>(IDLE);
  const fileIdentity = file
    ? `${file.name}:${file.size}:${file.lastModified}`
    : null;

  useEffect(() => {
    if (!file || !fileIdentity) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    setState({ status: "detecting", metadata: null, error: null });

    const formData = new FormData();
    formData.set("file", file);

    void detectAttendanceReportMetadataAction(formData).then(
      (result: DetectAttendanceReportState) => {
        if (cancelled) return;
        if (!result.ok) {
          setState({
            status: "error",
            error: result.error,
            metadata: buildAttendanceReportMetadata("UNKNOWN"),
          });
          return;
        }
        setState({
          status: "ready",
          metadata: result.metadata,
          error: null,
        });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [file, fileIdentity]);

  return state;
}
