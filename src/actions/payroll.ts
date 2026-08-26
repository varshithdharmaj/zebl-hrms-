"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { parseWithSchema } from "@/lib/validation/parse";
import { payrollHrDecisionSchema, payrollSettingsSchema } from "@/lib/validation/schemas/payroll";
import { getPayrollSettings } from "@/lib/payroll/payroll-settings";

export type PayrollActionState = {
  error?: string;
  success?: string;
};

export async function updatePayrollSettingsAction(
  _prev: PayrollActionState,
  formData: FormData
): Promise<PayrollActionState> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const parsed = parseWithSchema(payrollSettingsSchema, {
    payrollStartDay: formData.get("payrollStartDay"),
    requiredWorkMinutes: formData.get("requiredWorkMinutes"),
    breakMinutes: formData.get("breakMinutes"),
    requiredOfficeMinutes: formData.get("requiredOfficeMinutes"),
    otThresholdMinutes: formData.get("otThresholdMinutes"),
    halfDayThresholdMinutes: formData.get("halfDayThresholdMinutes"),
    graceMinutes: formData.get("graceMinutes"),
    shiftRulesJson: formData.get("shiftRulesJson") ?? "{}",
  });

  const shiftRulesJson = parsed.shiftRulesJson?.trim() || "{}";
  try {
    JSON.parse(shiftRulesJson);
  } catch {
    return { error: "Shift rules must be valid JSON." };
  }

  await prisma.payrollSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...parsed, shiftRulesJson },
    update: { ...parsed, shiftRulesJson },
  });

  await writeAuditLog({
    entityType: "payroll_settings",
    entityId: "default",
    action: AUDIT_ACTIONS.PAYROLL_SETTINGS_UPDATED,
    actorUserId: session.id,
    actorEmail: session.email,
    metadata: { payrollStartDay: parsed.payrollStartDay },
  });

  revalidatePath("/admin/payroll-settings");
  revalidatePath("/admin/payroll-attendance");

  return { success: "Payroll settings saved." };
}

export async function updatePayrollHrDecisionAction(
  _prev: PayrollActionState,
  formData: FormData
): Promise<PayrollActionState> {
  let session;
  try {
    session = await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const parsed = parseWithSchema(payrollHrDecisionSchema, {
    summaryId: formData.get("summaryId"),
    hrDecision: formData.get("hrDecision"),
    remarks: formData.get("remarks") ?? undefined,
  });

  const summary = await prisma.payrollAttendanceSummary.update({
    where: { id: parsed.summaryId },
    data: {
      hrDecision: parsed.hrDecision,
      remarks: parsed.remarks?.trim() || null,
    },
    include: { employee: { select: { id: true, name: true, employeeCode: true } } },
  });

  await writeAuditLog({
    entityType: "payroll_attendance_summary",
    entityId: String(summary.id),
    action: AUDIT_ACTIONS.PAYROLL_HR_DECISION_UPDATED,
    actorUserId: session.id,
    actorEmail: session.email,
    metadata: {
      employeeId: summary.employeeId,
      hrDecision: parsed.hrDecision,
    },
  });

  revalidatePath("/admin/payroll-attendance");

  return { success: "Saved" };
}

export async function refreshPayrollSummariesAction(
  periodKey: string
): Promise<PayrollActionState> {
  try {
    await requireAdminSession();
  } catch {
    return { error: "Unauthorized." };
  }

  const settings = await getPayrollSettings();
  const { parsePayrollPeriodKey } = await import("@/lib/payroll/payroll-period");
  const { recomputePayrollSummariesForPeriod } = await import("@/lib/payroll/payroll-summaries");
  const period = parsePayrollPeriodKey(periodKey, settings.payrollStartDay);
  const count = await recomputePayrollSummariesForPeriod(period);

  revalidatePath("/admin/payroll-attendance");

  return { success: `Refreshed summaries for ${count} employee(s).` };
}
