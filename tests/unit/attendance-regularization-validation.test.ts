import { describe, expect, it } from "vitest";
import {
  rejectRegularizationSchema,
  submitRegularizationSchema,
} from "@/lib/validation/schemas/attendance/regularization";

const baseInput = {
  attendanceDate: "2026-08-20",
  reason: "Forgot to swipe in this morning.",
};

describe("submitRegularizationSchema", () => {
  it("accepts a valid missing_check_in submission", () => {
    const result = submitRegularizationSchema.safeParse({
      ...baseInput,
      requestType: "missing_check_in",
      requestedCheckIn: "09:15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing_check_in without a requested check-in time", () => {
    const result = submitRegularizationSchema.safeParse({
      ...baseInput,
      requestType: "missing_check_in",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing_both without both requested times", () => {
    const result = submitRegularizationSchema.safeParse({
      ...baseInput,
      requestType: "missing_both",
      requestedCheckIn: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts missing_both with both requested times", () => {
    const result = submitRegularizationSchema.safeParse({
      ...baseInput,
      requestType: "missing_both",
      requestedCheckIn: "09:00",
      requestedCheckOut: "18:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a reason shorter than 10 characters", () => {
    const result = submitRegularizationSchema.safeParse({
      ...baseInput,
      requestType: "missing_check_out",
      requestedCheckOut: "18:00",
      reason: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed time string", () => {
    const result = submitRegularizationSchema.safeParse({
      ...baseInput,
      requestType: "missing_check_in",
      requestedCheckIn: "9am",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid date format", () => {
    const result = submitRegularizationSchema.safeParse({
      attendanceDate: "08/20/2026",
      reason: baseInput.reason,
      requestType: "attendance_missing",
      requestedCheckIn: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown request type", () => {
    const result = submitRegularizationSchema.safeParse({
      ...baseInput,
      requestType: "bogus_type",
    });
    expect(result.success).toBe(false);
  });
});

describe("rejectRegularizationSchema", () => {
  it("requires a rejection comment of at least 10 characters", () => {
    expect(
      rejectRegularizationSchema.safeParse({ requestId: 1, expectedVersion: 0, reviewComment: "too short" })
        .success
    ).toBe(false);
    expect(
      rejectRegularizationSchema.safeParse({
        requestId: 1,
        expectedVersion: 0,
        reviewComment: "This is a sufficiently long rejection reason.",
      }).success
    ).toBe(true);
  });
});
