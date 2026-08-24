import "server-only";

import { LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getISTDateParts } from "@/lib/integrations/biometric-attendance-derivation";

export class RegularizationEligibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegularizationEligibilityError";
  }
}

/**
 * Submission/approval-time eligibility checks. Deliberately excludes any
 * payroll-cycle lock — that is out of scope for this feature and may be
 * layered on later without touching this function's signature.
 */
export async function assertRegularizationEligible(params: {
  employeeId: number;
  attendanceDate: Date;
}): Promise<void> {
  const { employeeId, attendanceDate } = params;
  const dateParts = getISTDateParts(attendanceDate);
  const today = getISTDateParts(new Date());

  if (dateParts.dateString > today.dateString) {
    throw new RegularizationEligibilityError("Cannot request regularisation for a future date.");
  }

  const settings = await prisma.payrollSettings.findUnique({
    where: { id: "default" },
    select: { regularizationWindowDays: true },
  });
  const windowDays = settings?.regularizationWindowDays ?? 7;

  const dayMs = 24 * 60 * 60 * 1000;
  const requestDayUtc = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const ageDays = Math.round((todayUtc - requestDayUtc) / dayMs);

  if (ageDays > windowDays) {
    throw new RegularizationEligibilityError(
      `This date is outside the ${windowDays}-day regularisation window.`
    );
  }

  const [holiday, override, approvedLeave] = await Promise.all([
    prisma.holiday.findUnique({ where: { holidayDate: dateParts.attendanceDate } }),
    prisma.attendanceDateOverride.findUnique({ where: { date: dateParts.attendanceDate } }),
    prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        workflowStatus: LeaveWorkflowStatus.approved,
        startDate: { lte: dateParts.attendanceDate },
        endDate: { gte: dateParts.attendanceDate },
      },
      select: { id: true },
    }),
  ]);

  if (holiday && override?.type !== "working_day") {
    throw new RegularizationEligibilityError(
      `${dateParts.dateString} is a declared holiday (${holiday.name}).`
    );
  }

  if (override?.type === "weekly_off") {
    throw new RegularizationEligibilityError(`${dateParts.dateString} is marked as a weekly off.`);
  }

  if (approvedLeave) {
    throw new RegularizationEligibilityError(
      "You have approved leave covering this date. Contact HR if this needs correction."
    );
  }
}
