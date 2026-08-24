import { prisma } from "@/lib/prisma";
import type { ElPolicyDates } from "@/lib/leave/el-dates";

export type LeavePolicy = ElPolicyDates & {
  elAccrualAmount: number;
  slAnnualEntitlement: number;
  slCarryForward: boolean;
  slExpiryMonths: number | null;
};

const SETTINGS_ROW_ID = 1;

/** The single global Leave Settings row, upserting startup defaults on first read. */
export async function getLeavePolicySettings(): Promise<LeavePolicy> {
  const row = await prisma.leavePolicySettings.upsert({
    where: { id: SETTINGS_ROW_ID },
    create: { id: SETTINGS_ROW_ID },
    update: {},
  });

  return {
    cycleStartDay: row.cycleStartDay,
    elAccrualAmount: row.elAccrualAmount,
    elEligibilityMonths: row.elEligibilityMonths,
    elExpiryMonths: row.elExpiryMonths,
    slAnnualEntitlement: row.slAnnualEntitlement,
    slCarryForward: row.slCarryForward,
    slExpiryMonths: row.slExpiryMonths,
  };
}

export async function updateLeavePolicySettings(
  input: {
    cycleStartDay: number;
    elAccrualAmount: number;
    elEligibilityMonths: number;
    elExpiryMonths: number;
    slAnnualEntitlement: number;
    slCarryForward: boolean;
    slExpiryMonths: number | null;
  },
  updatedBy: string
) {
  return prisma.leavePolicySettings.upsert({
    where: { id: SETTINGS_ROW_ID },
    create: { id: SETTINGS_ROW_ID, ...input, updatedBy },
    update: { ...input, updatedBy },
  });
}
