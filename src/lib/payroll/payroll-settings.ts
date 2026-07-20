import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import type { PayrollSettingsSnapshot } from "@/lib/payroll/payroll-types";

export type { PayrollSettingsSnapshot, PayrollShiftRule } from "@/lib/payroll/payroll-types";
export { resolveShiftPayrollRules } from "@/lib/payroll/payroll-types";

const DEFAULT_ID = "default";

export const getPayrollSettings = cache(async (): Promise<PayrollSettingsSnapshot> => {
  const row = await ensurePayrollSettingsRow();
  let shiftRules: PayrollSettingsSnapshot["shiftRules"] = {};
  try {
    shiftRules = JSON.parse(row.shiftRulesJson || "{}") as PayrollSettingsSnapshot["shiftRules"];
  } catch {
    shiftRules = {};
  }

  return {
    payrollStartDay: row.payrollStartDay,
    requiredWorkMinutes: row.requiredWorkMinutes,
    breakMinutes: row.breakMinutes,
    requiredOfficeMinutes: row.requiredOfficeMinutes,
    otThresholdMinutes: row.otThresholdMinutes,
    halfDayThresholdMinutes: row.halfDayThresholdMinutes,
    graceMinutes: row.graceMinutes,
    shiftRules,
  };
});

function assertPayrollSettingsClient() {
  if (!prisma.payrollSettings) {
    throw new Error(
      "Prisma client is missing payroll models. Stop the dev server, run: npx prisma generate && npx prisma migrate deploy, then restart npm run dev."
    );
  }
}

async function ensurePayrollSettingsRow() {
  assertPayrollSettingsClient();
  const existing = await prisma.payrollSettings.findUnique({ where: { id: DEFAULT_ID } });
  if (existing) return existing;

  try {
    return await prisma.payrollSettings.create({ data: { id: DEFAULT_ID } });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return prisma.payrollSettings.findUniqueOrThrow({ where: { id: DEFAULT_ID } });
    }
    throw error;
  }
}
