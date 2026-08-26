"use server";

import { revalidatePath } from "next/cache";
import {
  countLeaveDays,
  getLeaveBalanceSummaries,
  processPendingLeaveAccruals,
} from "@/lib/leave";
import { isValidLeaveType } from "@/lib/leave-types";
import { requireEmployeeSession } from "@/lib/auth-guards";
import {
  createLeaveWorkflow,
  toWorkflowActor,
  WorkflowError,
} from "@/lib/workflow/leave-workflow";

export type ActionState = {
  error?: string;
  success?: string;
};

export async function applyLeaveAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireEmployeeSession();
  const employeeId = session.employeeId;

  const leaveType = String(formData.get("leaveType") ?? "").trim();
  const startDate = new Date(String(formData.get("startDate")));
  const endDate = new Date(String(formData.get("endDate")));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!isValidLeaveType(leaveType)) {
    return { error: "Please select a valid leave type (EL, CL, or SL)." };
  }

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { error: "Valid dates are required." };
  }

  if (endDate < startDate) {
    return { error: "End date cannot be before start date." };
  }

  if (!reason) {
    return { error: "Reason is required." };
  }

  const days = countLeaveDays(startDate, endDate);

  try {
    await processPendingLeaveAccruals(employeeId);
    const balances = await getLeaveBalanceSummaries(employeeId);
    const typeBalance = balances.find((b) => b.leaveType === leaveType);

    if (leaveType === "EL" && !typeBalance?.eligible) {
      return { error: "You are not yet eligible for Earned Leave (requires 1 year of service)." };
    }

    if ((typeBalance?.remaining ?? 0) < days) {
      return {
        error: `Insufficient ${leaveType} balance. Available: ${typeBalance?.remaining ?? 0}, requested: ${days}.`,
      };
    }

    await createLeaveWorkflow({
      employeeId,
      leaveType,
      startDate,
      endDate,
      days,
      reason,
      actor: toWorkflowActor(session),
    });

    revalidatePath("/employee/leaves");
    revalidatePath("/admin/leaves");
    revalidatePath("/manager/approvals");
    revalidatePath("/manager/dashboard");
    return { success: "Leave request submitted for approval." };
  } catch (e) {
    const message = e instanceof WorkflowError ? e.message : "Failed to submit leave request.";
    return { error: message };
  }
}
