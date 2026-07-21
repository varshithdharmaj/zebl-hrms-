"use server";

import { revalidatePath } from "next/cache";
import {
  advanceWorkflow,
  cancelWorkflow,
  rejectWorkflow,
  toWorkflowActor,
  withdrawWorkflow,
  WorkflowError,
} from "@/lib/workflow/leave-workflow";
import {
  requireAdminSession,
  requireApproveLeaveSession,
  requireEmployeeSession,
} from "@/lib/auth-guards";

export type WorkflowActionState = {
  error?: string;
  success?: string;
};

function revalidateLeavePaths(employeeId: number) {
  revalidatePath("/employee/leaves");
  revalidatePath("/employee/approvals");
  revalidatePath("/admin/leaves");
  revalidatePath(`/admin/employees/${employeeId}`);
}

export async function approveLeaveStepAction(
  _prev: WorkflowActionState,
  formData: FormData
): Promise<WorkflowActionState> {
  try {
    const session = await requireApproveLeaveSession();
    const leaveId = parseInt(String(formData.get("leaveId")), 10);
    const version = parseInt(String(formData.get("version") ?? ""), 10);

    if (!leaveId) return { error: "Invalid leave request." };

    const result = await advanceWorkflow(
      leaveId,
      toWorkflowActor(session),
      Number.isNaN(version) ? undefined : version
    );

    const leave = await import("@/lib/prisma").then((m) =>
      m.prisma.leaveRequest.findUnique({
        where: { id: leaveId },
        select: { employeeId: true },
      })
    );
    if (leave) revalidateLeavePaths(leave.employeeId);

    return { success: result.message };
  } catch (e) {
    const message = e instanceof WorkflowError ? e.message : "Approval failed.";
    return { error: message };
  }
}

export async function rejectLeaveStepAction(
  _prev: WorkflowActionState,
  formData: FormData
): Promise<WorkflowActionState> {
  try {
    const session = await requireApproveLeaveSession();
    const leaveId = parseInt(String(formData.get("leaveId")), 10);
    const version = parseInt(String(formData.get("version") ?? ""), 10);
    const comment = String(formData.get("comment") ?? "").trim();

    if (!leaveId) return { error: "Invalid leave request." };

    const result = await rejectWorkflow(
      leaveId,
      toWorkflowActor(session),
      comment,
      Number.isNaN(version) ? undefined : version
    );

    const leave = await import("@/lib/prisma").then((m) =>
      m.prisma.leaveRequest.findUnique({
        where: { id: leaveId },
        select: { employeeId: true },
      })
    );
    if (leave) revalidateLeavePaths(leave.employeeId);

    return { success: result.message };
  } catch (e) {
    const message = e instanceof WorkflowError ? e.message : "Rejection failed.";
    return { error: message };
  }
}

export async function withdrawLeaveAction(
  _prev: WorkflowActionState,
  formData: FormData
): Promise<WorkflowActionState> {
  try {
    const session = await requireEmployeeSession();
    const leaveId = parseInt(String(formData.get("leaveId")), 10);
    if (!leaveId) return { error: "Invalid leave request." };

    const result = await withdrawWorkflow(leaveId, toWorkflowActor(session));
    revalidateLeavePaths(session.employeeId);
    return { success: result.message };
  } catch (e) {
    const message = e instanceof WorkflowError ? e.message : "Withdrawal failed.";
    return { error: message };
  }
}

export async function cancelLeaveAction(
  _prev: WorkflowActionState,
  formData: FormData
): Promise<WorkflowActionState> {
  try {
    const session = await requireAdminSession();
    const leaveId = parseInt(String(formData.get("leaveId")), 10);
    const reason = String(formData.get("reason") ?? "").trim();
    if (!leaveId) return { error: "Invalid leave request." };

    const result = await cancelWorkflow(leaveId, toWorkflowActor(session), reason);

    const leave = await import("@/lib/prisma").then((m) =>
      m.prisma.leaveRequest.findUnique({
        where: { id: leaveId },
        select: { employeeId: true },
      })
    );
    if (leave) revalidateLeavePaths(leave.employeeId);

    return { success: result.message };
  } catch (e) {
    const message = e instanceof WorkflowError ? e.message : "Cancellation failed.";
    return { error: message };
  }
}
