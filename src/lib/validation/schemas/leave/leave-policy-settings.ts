import { z } from "zod";

const checkboxBoolean = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

export const leavePolicySettingsSchema = z
  .object({
    cycleStartDay: z.coerce.number().int().min(1).max(28),
    elAccrualAmount: z.coerce.number().positive().max(31),
    elEligibilityMonths: z.coerce.number().int().min(0).max(120),
    elExpiryMonths: z.coerce.number().int().min(1).max(600),
    slAnnualEntitlement: z.coerce.number().int().min(0).max(365),
    slCarryForward: checkboxBoolean,
    slExpiryMonths: z.coerce.number().int().min(1).max(600).optional().nullable(),
  })
  .transform((v) => ({
    ...v,
    // Expiry is only meaningful when carry-forward is enabled — otherwise SL
    // simply lapses at cycle-year end and there's nothing to expire.
    slExpiryMonths: v.slCarryForward ? (v.slExpiryMonths ?? null) : null,
  }));

export type LeavePolicySettingsInput = z.infer<typeof leavePolicySettingsSchema>;
