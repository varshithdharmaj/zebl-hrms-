import { z } from "zod";

const checkboxBoolean = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

export const weeklyScheduleSchema = z.object({
  mondayWorking: checkboxBoolean,
  tuesdayWorking: checkboxBoolean,
  wednesdayWorking: checkboxBoolean,
  thursdayWorking: checkboxBoolean,
  fridayWorking: checkboxBoolean,
  saturdayWorking: checkboxBoolean,
  sundayWorking: checkboxBoolean,
  expectedWorkMinutes: z.coerce.number().int().min(60).max(900),
});

export const dateOverrideCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  type: z.enum(["working_day", "weekly_off"]),
  reason: z.string().max(500).optional(),
});

export const dateOverrideRemoveSchema = z.object({
  id: z.coerce.number().int().positive(),
});
