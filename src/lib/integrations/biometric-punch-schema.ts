import { z } from "zod";

export const ESSL_TABLE_NAME_REGEX = /^(dbo\.)?DeviceLogs_(1[0-2]|[1-9])_\d{4}$/i;

export const biometricPunchEventSchema = z.object({
  source: z.string().trim().min(1, "source is required"),
  tableName: z
    .string()
    .trim()
    .regex(
      ESSL_TABLE_NAME_REGEX,
      "tableName must match expected ESSL monthly table format (e.g. dbo.DeviceLogs_8_2026)"
    ),
  deviceLogId: z
    .number()
    .int("deviceLogId must be an integer")
    .positive("deviceLogId must be a positive integer"),
  employeeCode: z.string().trim().min(1, "employeeCode is required"),
  punchedAt: z.union([
    z.date(),
    z
      .string()
      .transform((val) => {
        const trimmed = val.trim();
        // The bridge sends an explicit offset (e.g. "+05:30") or "Z" when the
        // instant is already unambiguous — trust it as-is.
        if (/[Zz]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
          return new Date(trimmed);
        }
        // Naive timestamp with no timezone: eSSL machines log local IST time,
        // so interpret the literal digits as +05:30.
        const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (match) {
          const [_, y, m, d, h, min, s] = match;
          return new Date(`${y}-${m}-${d}T${h}:${min}:${s}.000+05:30`);
        }
        return new Date(trimmed);
      })
      .refine((date) => !isNaN(date.getTime()), {
        message: "punchedAt must be a valid ISO date string",
      }),
  ]),
  deviceId: z
    .number()
    .int("deviceId must be an integer"),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const ingestBiometricPunchesSchema = z.object({
  events: z
    .array(biometricPunchEventSchema)
    .min(1, "events array must contain at least 1 event")
    .max(500, "Maximum batch size is 500 events per request"),
});

export type IngestBiometricPunchEventInput = z.infer<typeof biometricPunchEventSchema>;
export type IngestBiometricPunchesInput = z.infer<typeof ingestBiometricPunchesSchema>;
