"use server";

import { revalidatePath } from "next/cache";
import { requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { getLeavePolicySettings, updateLeavePolicySettings } from "@/lib/leave/leave-policy";
import { leavePolicySettingsSchema } from "@/lib/validation/schemas/leave/leave-policy-settings";
import { safeParseWithSchema } from "@/lib/validation/parse";

export type LeavePolicySettingsActionState = {
  error?: string;
  success?: string;
};

export async function getLeavePolicySettingsAction() {
  return getLeavePolicySettings();
}

export async function updateLeavePolicySettingsAction(
  _prev: LeavePolicySettingsActionState,
  formData: FormData
): Promise<LeavePolicySettingsActionState> {
  let session;
  try {
    session = await requireHROrSuperAdminSession();
  } catch {
    return { error: "Only HR or Super Admin may modify Leave Settings." };
  }

  const before = await getLeavePolicySettings();

  const validated = safeParseWithSchema(leavePolicySettingsSchema, {
    cycleStartDay: formData.get("cycleStartDay"),
    elAccrualAmount: formData.get("elAccrualAmount"),
    elEligibilityMonths: formData.get("elEligibilityMonths"),
    elExpiryMonths: formData.get("elExpiryMonths"),
    elEncashmentCapDays: formData.get("elEncashmentCapDays"),
    slAnnualEntitlement: formData.get("slAnnualEntitlement"),
    slCarryForward: formData.get("slCarryForward"),
    slExpiryMonths: formData.get("slExpiryMonths") || undefined,
    clAnnualEntitlement: formData.get("clAnnualEntitlement"),
    monthlyLeaveLimit: formData.get("monthlyLeaveLimit"),
    maxConsecutiveDays: formData.get("maxConsecutiveDays"),
    advanceNoticeDays: formData.get("advanceNoticeDays"),
  });
  if (!validated.ok) return { error: validated.error };

  await updateLeavePolicySettings(validated.data, session.email);

  await writeAuditLog({
    entityType: "leave_policy_settings",
    entityId: "1",
    action: AUDIT_ACTIONS.LEAVE_POLICY_SETTINGS_UPDATED,
    actorUserId: session.id,
    actorEmail: session.email,
    oldValue: before,
    newValue: validated.data,
  });

  revalidatePath("/admin/leave-settings");
  revalidatePath("/admin/leaves");
  revalidatePath("/employee/leaves");

  return { success: "Leave Settings saved." };
}
