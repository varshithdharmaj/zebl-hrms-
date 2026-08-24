import { z } from "zod";

export const REGULARIZATION_REQUEST_TYPES = [
  "missing_check_in",
  "missing_check_out",
  "missing_both",
  "incorrect_check_in",
  "incorrect_check_out",
  "attendance_missing",
  "device_failure",
] as const;

const timeString = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM format.");

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 1000;

const TYPES_REQUIRING_CHECK_IN = new Set([
  "missing_check_in",
  "incorrect_check_in",
  "missing_both",
  "attendance_missing",
  "device_failure",
]);
const TYPES_REQUIRING_CHECK_OUT = new Set(["missing_check_out", "incorrect_check_out", "missing_both"]);

export const submitRegularizationSchema = z
  .object({
    attendanceDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
    requestType: z.enum(REGULARIZATION_REQUEST_TYPES),
    requestedCheckIn: timeString.optional().nullable(),
    requestedCheckOut: timeString.optional().nullable(),
    checkOutNextDay: z.boolean().optional().default(false),
    reason: z
      .string()
      .trim()
      .min(MIN_REASON_LENGTH, `Reason must be at least ${MIN_REASON_LENGTH} characters.`)
      .max(MAX_REASON_LENGTH),
    previousRequestId: z.number().int().positive().optional(),
  })
  .superRefine((val, ctx) => {
    if (TYPES_REQUIRING_CHECK_IN.has(val.requestType) && !val.requestedCheckIn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestedCheckIn"],
        message: "Requested check-in time is required for this request type.",
      });
    }
    if (TYPES_REQUIRING_CHECK_OUT.has(val.requestType) && !val.requestedCheckOut) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestedCheckOut"],
        message: "Requested check-out time is required for this request type.",
      });
    }
  });

export type SubmitRegularizationInput = z.infer<typeof submitRegularizationSchema>;

export const reviewRegularizationSchema = z.object({
  requestId: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(),
  reviewComment: z.string().trim().max(MAX_REASON_LENGTH).optional(),
});
export type ReviewRegularizationInput = z.infer<typeof reviewRegularizationSchema>;

export const rejectRegularizationSchema = z.object({
  requestId: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(),
  reviewComment: z
    .string()
    .trim()
    .min(10, "Rejection comment must be at least 10 characters.")
    .max(MAX_REASON_LENGTH),
});
export type RejectRegularizationInput = z.infer<typeof rejectRegularizationSchema>;
