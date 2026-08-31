import { prisma } from "@/lib/prisma";
import type { ElPolicyDates } from "@/lib/leave/el-dates";

export type LeavePolicy = ElPolicyDates & {
  elAccrualAmount: number;
  elEncashmentCapDays: number;
  slAnnualEntitlement: number;
  slCarryForward: boolean;
  slExpiryMonths: number | null;
  clAnnualEntitlement: number;
  monthlyLeaveLimit: number;
  maxConsecutiveDays: number;
  advanceNoticeDays: number;
};

const SETTINGS_ROW_ID = 1;

function toPolicy(row: {
  cycleStartDay: number;
  elAccrualAmount: number;
  elEligibilityMonths: number;
  elExpiryMonths: number;
  elEncashmentCapDays: number;
  slAnnualEntitlement: number;
  slCarryForward: boolean;
  slExpiryMonths: number | null;
  clAnnualEntitlement: number;
  monthlyLeaveLimit: number;
  maxConsecutiveDays: number;
  advanceNoticeDays: number;
}): LeavePolicy {
  return {
    cycleStartDay: row.cycleStartDay,
    elAccrualAmount: row.elAccrualAmount,
    elEligibilityMonths: row.elEligibilityMonths,
    elExpiryMonths: row.elExpiryMonths,
    elEncashmentCapDays: row.elEncashmentCapDays,
    slAnnualEntitlement: row.slAnnualEntitlement,
    slCarryForward: row.slCarryForward,
    slExpiryMonths: row.slExpiryMonths,
    clAnnualEntitlement: row.clAnnualEntitlement,
    monthlyLeaveLimit: row.monthlyLeaveLimit,
    maxConsecutiveDays: row.maxConsecutiveDays,
    advanceNoticeDays: row.advanceNoticeDays,
  };
}

/**
 * The single global Leave Settings row. Reads with a plain findUnique (not
 * upsert) so a pure read never issues a write — upsert's update branch would
 * otherwise touch `updatedAt` via Prisma's @updatedAt on every single read,
 * making that column useless as a "last changed by HR" audit signal and
 * turning this singleton row into a write-lock hotspot. The row is expected
 * to always exist post-migration; create is only a defensive fallback.
 */
export async function getLeavePolicySettings(): Promise<LeavePolicy> {
  const existing = await prisma.leavePolicySettings.findUnique({
    where: { id: SETTINGS_ROW_ID },
  });
  if (existing) return toPolicy(existing);

  const created = await prisma.leavePolicySettings.create({
    data: { id: SETTINGS_ROW_ID },
  });
  return toPolicy(created);
}

export async function updateLeavePolicySettings(
  input: {
    cycleStartDay: number;
    elAccrualAmount: number;
    elEligibilityMonths: number;
    elExpiryMonths: number;
    elEncashmentCapDays: number;
    slAnnualEntitlement: number;
    slCarryForward: boolean;
    slExpiryMonths: number | null;
    clAnnualEntitlement: number;
    monthlyLeaveLimit: number;
    maxConsecutiveDays: number;
    advanceNoticeDays: number;
  },
  updatedBy: string
) {
  return prisma.leavePolicySettings.upsert({
    where: { id: SETTINGS_ROW_ID },
    create: { id: SETTINGS_ROW_ID, ...input, updatedBy },
    update: { ...input, updatedBy },
  });
}
