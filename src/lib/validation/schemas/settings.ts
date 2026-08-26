import { z } from "zod";

export const escalationHoursSchema = z.coerce
  .number()
  .int()
  .min(1, "Escalation hours must be at least 1.")
  .max(720, "Escalation hours cannot exceed 720.");

export const hrSettingsSchema = z.object({
  escalationHours: escalationHoursSchema,
  teamsEnabled: z.coerce.boolean().optional(),
  calendarSyncEnabled: z.coerce.boolean().optional(),
  orgSyncEnabled: z.coerce.boolean().optional(),
  teamsWebhookUrl: z.string().trim().optional(),
});
