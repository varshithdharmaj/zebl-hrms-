"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { initializeEmployeeLeaveBalances } from "@/lib/leave";
import { isValidEmployeeStatus, statusToIsActive } from "@/lib/employee-types";
import { requireManageEmployeeSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { detectCircularManagerRelationship } from "@/lib/org";

export type ActionState = {
  error?: string;
  success?: string;
};

function parseInitialBalance(formData: FormData, field: string): number {
  const val = parseFloat(String(formData.get(field) ?? "0"));
  return Number.isNaN(val) ? 0 : Math.max(0, val);
}

function parseManagerId(formData: FormData): number | null {
  const raw = String(formData.get("managerId") ?? "").trim();
  if (!raw || raw === "none") return null;
  const id = parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

export async function createEmployeeAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireManageEmployeeSession();

    const employeeCode = String(formData.get("employeeCode") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const department = String(formData.get("department") ?? "").trim();
    const designation = String(formData.get("designation") ?? "").trim();
    const shift = String(formData.get("shift") ?? "").trim();
    const joiningDateStr = String(formData.get("joiningDate") ?? "").trim();
    const employeeStatus = String(formData.get("employeeStatus") ?? "Active").trim();
    const createLogin = formData.get("createLogin") === "on";
    const password = String(formData.get("password") ?? "");

    if (!employeeCode || !name) {
      return { error: "Employee code and name are required." };
    }

    if (!joiningDateStr) {
      return { error: "Joining date is required." };
    }

    const joiningDate = new Date(joiningDateStr);
    if (Number.isNaN(joiningDate.getTime())) {
      return { error: "Invalid joining date." };
    }

    if (!isValidEmployeeStatus(employeeStatus)) {
      return { error: "Invalid employee status." };
    }

    const existing = await prisma.employee.findUnique({ where: { employeeCode } });
    if (existing) {
      return { error: "Employee code already exists." };
    }

    if (createLogin) {
      if (!email) return { error: "Email is required to create login." };
      if (!password || password.length < 6) {
        return { error: "Password must be at least 6 characters." };
      }
      const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existingUser) return { error: "User with this email already exists." };
    }

    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        name,
        email: email || null,
        phone: phone || null,
        department: department || null,
        designation: designation || null,
        shift: shift || null,
        joiningDate,
        employeeStatus,
        isActive: statusToIsActive(employeeStatus),
      },
    });

    if (createLogin && email && password) {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: passwordHash,
          role: UserRole.employee,
          employeeId: employee.id,
        },
      });
    }

    await initializeEmployeeLeaveBalances(
      employee.id,
      {
        el: parseInitialBalance(formData, "initialEl"),
        cl: parseInitialBalance(formData, "initialCl"),
        sl: parseInitialBalance(formData, "initialSl"),
      },
      session.email
    );

    await writeAuditLog({
      entityType: "employee",
      entityId: String(employee.id),
      action: AUDIT_ACTIONS.EMPLOYEE_UPDATED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: { operation: "create", employeeCode },
    });

    revalidatePath("/admin/employees");
    return { success: "Employee created successfully." };
  } catch {
    return { error: "Failed to create employee." };
  }
}

export async function updateEmployeeProfileAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireManageEmployeeSession();

    const id = parseInt(String(formData.get("id")), 10);
    const employeeCode = String(formData.get("employeeCode") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const department = String(formData.get("department") ?? "").trim();
    const designation = String(formData.get("designation") ?? "").trim();
    const shift = String(formData.get("shift") ?? "").trim();
    const joiningDateStr = String(formData.get("joiningDate") ?? "").trim();
    const employeeStatus = String(formData.get("employeeStatus") ?? "Active").trim();
    const managerId = parseManagerId(formData);

    if (!id || !name || !employeeCode || !joiningDateStr) {
      return { error: "Required fields are missing." };
    }

    const joiningDate = new Date(joiningDateStr);
    if (Number.isNaN(joiningDate.getTime())) {
      return { error: "Invalid joining date." };
    }

    if (!isValidEmployeeStatus(employeeStatus)) {
      return { error: "Invalid employee status." };
    }

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) return { error: "Employee not found." };

    if (managerId !== null) {
      if (managerId === id) {
        return { error: "An employee cannot be their own manager." };
      }
      const managerExists = await prisma.employee.findUnique({ where: { id: managerId } });
      if (!managerExists) return { error: "Selected manager not found." };
      const circular = await detectCircularManagerRelationship(id, managerId);
      if (circular) {
        return { error: "This assignment would create a circular reporting chain." };
      }
    }

    const duplicate = await prisma.employee.findFirst({
      where: { employeeCode, NOT: { id } },
    });
    if (duplicate) {
      return { error: "Employee code already in use." };
    }

    const previousManagerId = existing.managerId;

    await prisma.employee.update({
      where: { id },
      data: {
        employeeCode,
        name,
        email: email || null,
        phone: phone || null,
        department: department || null,
        designation: designation || null,
        shift: shift || null,
        joiningDate,
        employeeStatus,
        isActive: statusToIsActive(employeeStatus),
        managerId,
      },
    });

    await writeAuditLog({
      entityType: "employee",
      entityId: String(id),
      action: AUDIT_ACTIONS.EMPLOYEE_UPDATED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: { operation: "profile_update", employeeCode },
    });

    if (previousManagerId !== managerId) {
      if (managerId === null) {
        await writeAuditLog({
          entityType: "employee",
          entityId: String(id),
          action: AUDIT_ACTIONS.EMPLOYEE_MANAGER_REMOVED,
          actorUserId: session.id,
          actorEmail: session.email,
          metadata: { previousManagerId },
        });
      } else {
        await writeAuditLog({
          entityType: "employee",
          entityId: String(id),
          action: AUDIT_ACTIONS.EMPLOYEE_MANAGER_ASSIGNED,
          actorUserId: session.id,
          actorEmail: session.email,
          metadata: { managerId, previousManagerId },
        });
      }
    }

    revalidatePath(`/admin/employees/${id}`);
    revalidatePath("/admin/employees");
    revalidatePath("/manager/dashboard");
    return { success: "Profile updated successfully." };
  } catch {
    return { error: "Failed to update employee profile." };
  }
}

export async function toggleEmployeeStatusFormAction(formData: FormData): Promise<void> {
  const employeeId = parseInt(String(formData.get("employeeId")), 10);
  if (employeeId) await toggleEmployeeStatusAction(employeeId);
}

export async function toggleEmployeeStatusAction(employeeId: number): Promise<ActionState> {
  try {
    await requireManageEmployeeSession();

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return { error: "Employee not found." };

    const newStatus = employee.employeeStatus === "Active" ? "Inactive" : "Active";

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        employeeStatus: newStatus,
        isActive: newStatus === "Active",
      },
    });

    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${employeeId}`);
    return { success: `Employee marked as ${newStatus}.` };
  } catch {
    return { error: "Failed to update employee status." };
  }
}
