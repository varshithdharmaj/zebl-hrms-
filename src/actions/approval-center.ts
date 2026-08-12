"use server";

import { revalidatePath } from "next/cache";
import { getApplicationSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import {
  actOnApprovalCase,
  listApprovalCenterCases,
} from "@/lib/approvals/approval-center-service";
import type { ApprovalCase, ApprovalCaseAction } from "@/lib/approvals/types";
import { parseLeaveCaseId } from "@/lib/approvals/types";

export type ListApprovalCenterResult =
  | { ok: true; cases: ApprovalCase[] }
  | { ok: false; error: string };

export type ActOnApprovalCaseResult = {
  error?: string;
  success?: string;
};

function canUseApprovalCenter(session: SessionUser): boolean {
  return canAccessAdmin(session.role) || session.employeeId != null;
}

/**
 * Lists Approval Center cases (leave only in V1).
 */
export async function listApprovalCenterAction(
  caseType?: "leave"
): Promise<ListApprovalCenterResult> {
  const session = await getApplicationSession();
  if (!session || !canUseApprovalCenter(session)) {
    return { ok: false, error: "Unauthorized." };
  }

  try {
    const cases = await listApprovalCenterCases(session, caseType ?? "leave");
    return { ok: true, cases };
  } catch (err) {
    console.error("[zebl] listApprovalCenterAction failed:", err);
    return { ok: false, error: "Failed to load approval center." };
  }
}

/**
 * Dispatches approve/reject to the registered adapter (leave only today).
 * Domain authorization remains in the leave workflow layer.
 */
export async function actOnApprovalCaseAction(
  _prev: ActOnApprovalCaseResult,
  formData: FormData
): Promise<ActOnApprovalCaseResult> {
  const session = await getApplicationSession();
  if (!session || !canUseApprovalCenter(session)) {
    return { error: "Unauthorized." };
  }

  const caseId = String(formData.get("caseId") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim() as ApprovalCaseAction;
  const comment = String(formData.get("comment") ?? "").trim();
  const versionRaw = String(formData.get("version") ?? "").trim();
  const version = versionRaw ? parseInt(versionRaw, 10) : undefined;

  if (!caseId || (action !== "approve" && action !== "reject" && action !== "view")) {
    return { error: "Invalid approval action." };
  }

  const result = await actOnApprovalCase(session, caseId, {
    action,
    comment: comment || undefined,
    version: version !== undefined && !Number.isNaN(version) ? version : undefined,
  });

  if (result.success && action !== "view") {
    const leaveId = parseLeaveCaseId(caseId);
    if (leaveId != null) {
      const leave = await import("@/lib/prisma").then((m) =>
        m.prisma.leaveRequest.findUnique({
          where: { id: leaveId },
          select: { employeeId: true },
        })
      );
      if (leave) {
        revalidatePath("/employee/leaves");
        revalidatePath("/employee/dashboard");
        revalidatePath("/employee/approvals");
        revalidatePath("/admin/leaves");
        revalidatePath(`/admin/employees/${leave.employeeId}`);
        revalidatePath("/employee/team");
      }
    }
  }

  return result;
}
