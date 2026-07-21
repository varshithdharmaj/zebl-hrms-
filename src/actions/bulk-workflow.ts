"use server";

import { revalidatePath } from "next/cache";
import {
  advanceWorkflow,
  rejectWorkflow,
  toWorkflowActor,
} from "@/lib/workflow/leave-workflow";
import { requireApproveLeaveSession, requireAdminSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { MIN_REJECTION_COMMENT_LENGTH } from "@/lib/workflow/workflow-types";
import { bulkLeaveItemsSchema } from "@/lib/validation";
import { safeParseWithSchema } from "@/lib/validation/parse";
import type { BulkActionState } from "@/actions/types";

export type { BulkActionState };

export async function bulkApproveLeavesAction(
  _prev: BulkActionState,
  formData: FormData
): Promise<BulkActionState> {
  try {
    const session = await requireApproveLeaveSession();
    const raw = String(formData.get("items") ?? "[]");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: "Invalid request payload." };
    }
    const validated = safeParseWithSchema(bulkLeaveItemsSchema, parsed);
    if (!validated.ok) return { error: validated.error };
    const items = validated.data;

    let processed = 0;
    let failed = 0;
    const actor = toWorkflowActor(session);

    for (const item of items) {
      try {
        await advanceWorkflow(item.leaveId, actor, item.version);
        processed += 1;
      } catch {
        failed += 1;
      }
    }

    await writeAuditLog({
      entityType: "bulk_operation",
      entityId: `approve-${Date.now()}`,
      action: AUDIT_ACTIONS.LEAVE_STEP_APPROVED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: { operation: "bulk_approve", processed, failed, count: items.length },
    });

    revalidatePath("/employee/approvals");
    revalidatePath("/admin/leaves");
    revalidatePath("/admin/dashboard");

    return {
      success: `Approved ${processed} request(s)${failed > 0 ? `, ${failed} failed` : ""}.`,
      processed,
      failed,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bulk approval failed." };
  }
}

export async function bulkRejectLeavesAction(
  _prev: BulkActionState,
  formData: FormData
): Promise<BulkActionState> {
  try {
    const session = await requireApproveLeaveSession();
    const raw = String(formData.get("items") ?? "[]");
    const comment = String(formData.get("comment") ?? "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: "Invalid request payload." };
    }
    const validated = safeParseWithSchema(bulkLeaveItemsSchema, parsed);
    if (!validated.ok) return { error: validated.error };
    const items = validated.data;

    if (comment.length < MIN_REJECTION_COMMENT_LENGTH) {
      return {
        error: `Rejection reason must be at least ${MIN_REJECTION_COMMENT_LENGTH} characters.`,
      };
    }

    let processed = 0;
    let failed = 0;
    const actor = toWorkflowActor(session);

    for (const item of items) {
      try {
        await rejectWorkflow(item.leaveId, actor, comment, item.version);
        processed += 1;
      } catch {
        failed += 1;
      }
    }

    await writeAuditLog({
      entityType: "bulk_operation",
      entityId: `reject-${Date.now()}`,
      action: AUDIT_ACTIONS.LEAVE_REJECTED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: { operation: "bulk_reject", processed, failed, count: items.length },
    });

    revalidatePath("/employee/approvals");
    revalidatePath("/admin/leaves");

    return {
      success: `Rejected ${processed} request(s)${failed > 0 ? `, ${failed} failed` : ""}.`,
      processed,
      failed,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bulk rejection failed." };
  }
}

export async function bulkAssignManagerAction(
  _prev: BulkActionState,
  formData: FormData
): Promise<BulkActionState> {
  try {
    const session = await requireAdminSession();
    const employeeIds = String(formData.get("employeeIds") ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    const managerIdRaw = String(formData.get("managerId") ?? "");
    const managerId =
      managerIdRaw === "none" || managerIdRaw === ""
        ? null
        : parseInt(managerIdRaw, 10);

    if (employeeIds.length === 0) return { error: "No employees selected." };

    const { prisma } = await import("@/lib/prisma");
    const { detectCircularManagerRelationship } = await import("@/lib/org");

    for (const id of employeeIds) {
      if (managerId !== null) {
        const circular = await detectCircularManagerRelationship(id, managerId);
        if (circular) {
          return { error: `Circular manager chain detected for employee #${id}.` };
        }
      }
      await prisma.employee.update({
        where: { id },
        data: { managerId },
      });
    }

    await writeAuditLog({
      entityType: "bulk_operation",
      entityId: `manager-${Date.now()}`,
      action: AUDIT_ACTIONS.EMPLOYEE_MANAGER_ASSIGNED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: { operation: "bulk_manager_assign", employeeIds, managerId },
    });

    revalidatePath("/admin/employees");
    return { success: `Updated manager for ${employeeIds.length} employee(s).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Bulk assignment failed." };
  }
}
