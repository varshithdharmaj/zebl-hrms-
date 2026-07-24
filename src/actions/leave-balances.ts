"use server";

import { revalidatePath } from "next/cache";
import {
  adminAdjustLeaveBalance,
  getLeaveBalanceSummaries,
  getLeaveBalanceSummariesForEmployees,
  getLeaveTransactionHistory,
  processPendingLeaveAccruals,
} from "@/lib/leave";
import { isValidLeaveType } from "@/lib/leave-types";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guards";
import { getSession } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/permissions";

export type ActionState = {
  error?: string;
  success?: string;
};

export async function adjustLeaveBalanceAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireAdminSession();

    const employeeId = parseInt(String(formData.get("employeeId")), 10);
    const leaveType = String(formData.get("leaveType") ?? "").trim();
    const adjustment = parseFloat(String(formData.get("adjustment")));
    const reason = String(formData.get("note") ?? formData.get("reason") ?? "").trim();

    if (!employeeId || !isValidLeaveType(leaveType)) {
      return { error: "Invalid employee or leave type." };
    }

    if (Number.isNaN(adjustment) || adjustment === 0) {
      return { error: "Enter a non-zero adjustment (+ add / − deduct)." };
    }

    await adminAdjustLeaveBalance({
      employeeId,
      leaveType,
      adjustment,
      reason: reason || "Manual HR adjustment",
      createdBy: session.email,
    });

    revalidatePath("/admin/leaves");
    revalidatePath(`/admin/employees/${employeeId}`);
    revalidatePath("/employee/leaves");
    return {
      success: `${leaveType} adjusted by ${adjustment > 0 ? "+" : ""}${adjustment}.`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to adjust balance.";
    return { error: message };
  }
}

export async function syncEmployeeAccrualsAction(employeeId: number): Promise<ActionState> {
  try {
    await requireAdminSession();
    await processPendingLeaveAccruals(employeeId);
    revalidatePath(`/admin/employees/${employeeId}`);
    return { success: "Pending accruals processed." };
  } catch {
    return { error: "Failed to process accruals." };
  }
}

export async function getEmployeeProfileLeaveData(employeeId: number) {
  const session = await getSession();
  if (!session) return { balances: [], history: [] };

  // HR/Super Admin, the employee themselves, or their direct manager (hierarchy-scoped).
  const isDirectManager =
    session.employeeId != null &&
    session.employeeId !== employeeId &&
    (await prisma.employee.count({
      where: { id: employeeId, managerId: session.employeeId },
    })) > 0;

  const canAccess =
    canAccessAdmin(session.role) ||
    session.employeeId === employeeId ||
    isDirectManager;
  if (!canAccess) return { balances: [], history: [] };

  await processPendingLeaveAccruals(employeeId);
  const [balances, history] = await Promise.all([
    getLeaveBalanceSummaries(employeeId),
    getLeaveTransactionHistory(employeeId),
  ]);
  return { balances, history };
}

export async function getAdminLeaveBalancesOverview() {
  const session = await getSession();
  if (!session || !canAccessAdmin(session.role)) return [];

  const employees = await prisma.employee.findMany({
    where: { employeeStatus: { not: "Resigned" } },
    orderBy: { name: "asc" },
  });

  const summariesByEmployee = await getLeaveBalanceSummariesForEmployees(employees);

  return employees.map((emp) => ({
    employeeId: emp.id,
    employeeCode: emp.employeeCode,
    name: emp.name,
    department: emp.department,
    joiningDate: emp.joiningDate,
    balances: summariesByEmployee.get(emp.id) ?? [],
  }));
}
