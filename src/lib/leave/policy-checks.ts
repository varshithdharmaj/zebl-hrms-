import { prisma } from "@/lib/prisma";
import { LeaveWorkflowStatus } from "@/generated/prisma/enums";
import { getLeaveCycleWindow } from "@/lib/leave/el-dates";
import type { LeavePolicy } from "@/lib/leave/leave-policy";
import { startOfDay } from "@/lib/utils";

/**
 * Sum of days already requested (pending or approved — both "count" against
 * the monthly limit; a rejected/withdrawn/cancelled request does not) for an
 * employee within the leave cycle (26th–25th by default) containing
 * `referenceDate`. Used to enforce the policy's monthly paid-leave cap.
 */
export async function getLeaveDaysInCycle(
  employeeId: number,
  policy: LeavePolicy,
  referenceDate: Date = new Date()
): Promise<number> {
  const { startDate, endDate } = getLeaveCycleWindow(policy, referenceDate);
  const requests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      workflowStatus: {
        in: [LeaveWorkflowStatus.pending_approval, LeaveWorkflowStatus.approved],
      },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { days: true },
  });
  return requests.reduce((sum, r) => sum + r.days, 0);
}

/**
 * Validates the three request-time policy rules that are independent of
 * leave-type balance: max consecutive days, advance notice (SL exempt — it's
 * inherently unplanned/emergency, per the HR policy's own "in case of
 * emergency at least a verbal approval" language for sick leave), and the
 * monthly paid-leave limit (beyond which the excess is LOP — this function
 * only reports how many days would be unpayable; it never creates a leave
 * request itself and never auto-converts the type).
 */
export async function validateLeaveRequestPolicy(params: {
  employeeId: number;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  days: number;
  policy: LeavePolicy;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { employeeId, leaveType, startDate, days, policy } = params;

  if (days > policy.maxConsecutiveDays) {
    return {
      ok: false,
      error: `A maximum of ${policy.maxConsecutiveDays} consecutive days can be requested at a time.`,
    };
  }

  if (leaveType !== "SL" && policy.advanceNoticeDays > 0) {
    const earliestAllowed = new Date(startOfDay(new Date()));
    earliestAllowed.setDate(earliestAllowed.getDate() + policy.advanceNoticeDays);
    if (startOfDay(startDate) < earliestAllowed) {
      return {
        ok: false,
        error: `Leave requests require at least ${policy.advanceNoticeDays} days' advance notice (Sick Leave is exempt).`,
      };
    }
  }

  const alreadyInCycle = await getLeaveDaysInCycle(employeeId, policy, startDate);
  const totalInCycle = alreadyInCycle + days;
  if (totalInCycle > policy.monthlyLeaveLimit) {
    const overBy = totalInCycle - policy.monthlyLeaveLimit;
    return {
      ok: false,
      error: `This would exceed the monthly leave limit of ${policy.monthlyLeaveLimit} day(s) (already requested ${alreadyInCycle} this cycle). ${overBy} day(s) would be Loss of Pay — reduce the requested days or contact HR.`,
    };
  }

  return { ok: true };
}
