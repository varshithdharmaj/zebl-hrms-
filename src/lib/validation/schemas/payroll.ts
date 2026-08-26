import { z } from "zod";

export const payrollSettingsSchema = z.object({
  payrollStartDay: z.coerce.number().int().min(1).max(28),
  requiredWorkMinutes: z.coerce.number().int().min(60).max(720),
  breakMinutes: z.coerce.number().int().min(0).max(180),
  requiredOfficeMinutes: z.coerce.number().int().min(60).max(900),
  otThresholdMinutes: z.coerce.number().int().min(0).max(240),
  halfDayThresholdMinutes: z.coerce.number().int().min(30).max(480),
  graceMinutes: z.coerce.number().int().min(0).max(120),
  shiftRulesJson: z.string().optional(),
});

export const payrollHrDecisionSchema = z.object({
  summaryId: z.coerce.number().int().positive(),
  hrDecision: z.enum([
    "no_action",
    "apply_leave",
    "salary_deduction",
    "warning",
    "approved_exception",
  ]),
  remarks: z.string().max(2000).optional(),
});
