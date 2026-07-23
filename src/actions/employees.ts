"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { AccountStatus, UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { initializeEmployeeLeaveBalances } from "@/lib/leave";
import { isValidEmployeeStatus, statusToIsActive } from "@/lib/employee-types";
import { requireManageEmployeeSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { detectCircularManagerRelationship } from "@/lib/org";
import { employeeProfileUpdateSchema } from "@/lib/validation/schemas/employee-account";
import { safeParseWithSchema } from "@/lib/validation/parse";
import { canAdministerEmployeeAccount } from "@/lib/permissions";
import { toAppUserRole } from "@/lib/roles";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import { invalidateUserSessions } from "@/lib/auth";

export type ActionState = {
  error?: string;
  success?: string;
};

function parseInitialBalance(formData: FormData, field: string): number {
  const val = parseFloat(String(formData.get(field) ?? "0"));
  return Number.isNaN(val) ? 0 : Math.max(0, val);
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
    const parsed = safeParseWithSchema(employeeProfileUpdateSchema, {
      id: formData.get("id"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      preferredName: formData.get("preferredName"),
      name: formData.get("name"),
      gender: formData.get("gender"),
      dateOfBirth: formData.get("dateOfBirth"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      alternatePhone: formData.get("alternatePhone"),
      address: formData.get("address"),
      emergencyContact: formData.get("emergencyContact"),
      department: formData.get("department"),
      designation: formData.get("designation"),
      employmentType: formData.get("employmentType"),
      workLocation: formData.get("workLocation"),
      shift: formData.get("shift"),
      joiningDate: formData.get("joiningDate"),
      employeeStatus: formData.get("employeeStatus"),
      managerId: formData.get("managerId") ?? "",
    });
    if (!parsed.ok) return { error: parsed.error };
    const data = parsed.data;

    const existing = await prisma.employee.findUnique({
      where: { id: data.id },
      include: { user: true },
    });
    if (!existing) return { error: "Employee not found." };
    if (
      existing.user &&
      !canAdministerEmployeeAccount(session.role, toAppUserRole(existing.user.role))
    ) {
      return { error: "You are not permitted to edit this employee." };
    }
    if (data.email) {
      const duplicateEmail = await prisma.employee.findFirst({
        where: {
          id: { not: data.id },
          email: { equals: data.email, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicateEmail) return { error: "Employee email is already in use." };
    }

    if (data.managerId !== null) {
      if (data.managerId === data.id) {
        return { error: "An employee cannot be their own manager." };
      }
      const managerExists = await prisma.employee.findUnique({ where: { id: data.managerId } });
      if (!managerExists) return { error: "Selected manager not found." };
      const circular = await detectCircularManagerRelationship(data.id, data.managerId);
      if (circular) {
        return { error: "This assignment would create a circular reporting chain." };
      }
    }

    const previousManagerId = existing.managerId;
    const requestContext = await getRequestSecurityContext();
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: data.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          preferredName: data.preferredName,
          name: data.name,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth,
          email: data.email,
          phone: data.phone,
          alternatePhone: data.alternatePhone,
          address: data.address,
          emergencyContact: data.emergencyContact,
          department: data.department,
          designation: data.designation,
          employmentType: data.employmentType,
          workLocation: data.workLocation,
          shift: data.shift,
          joiningDate: data.joiningDate,
          employeeStatus: data.employeeStatus,
          isActive: statusToIsActive(data.employeeStatus),
          managerId: data.managerId,
        },
      });
      if (existing.user && existing.employeeStatus !== data.employeeStatus) {
        const accountStatus =
          data.employeeStatus === "Active"
            ? AccountStatus.active
            : data.employeeStatus === "Terminated"
              ? AccountStatus.terminated
              : AccountStatus.inactive;
        await tx.user.update({
          where: { id: existing.user.id },
          data: {
            accountStatus,
            isActive: accountStatus === AccountStatus.active,
          },
        });
      }

      await writeAuditLog({
        entityType: "employee",
        entityId: String(data.id),
        action: AUDIT_ACTIONS.EMPLOYEE_UPDATED,
        actorUserId: session.id,
        actorEmail: session.email,
        employeeId: data.id,
        module: "employees",
        description: "Employee profile information was updated.",
        oldValue: {
          firstName: existing.firstName,
          lastName: existing.lastName,
          preferredName: existing.preferredName,
          name: existing.name,
          gender: existing.gender,
          dateOfBirth: existing.dateOfBirth?.toISOString() ?? null,
          email: existing.email,
          phone: existing.phone,
          alternatePhone: existing.alternatePhone,
          address: existing.address,
          emergencyContact: existing.emergencyContact,
          department: existing.department,
          designation: existing.designation,
          employmentType: existing.employmentType,
          workLocation: existing.workLocation,
          shift: existing.shift,
          joiningDate: existing.joiningDate.toISOString(),
          managerId: existing.managerId,
          employeeStatus: existing.employeeStatus,
        },
        newValue: {
          firstName: data.firstName,
          lastName: data.lastName,
          preferredName: data.preferredName,
          name: data.name,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth?.toISOString() ?? null,
          email: data.email,
          phone: data.phone,
          alternatePhone: data.alternatePhone,
          address: data.address,
          emergencyContact: data.emergencyContact,
          department: data.department,
          designation: data.designation,
          employmentType: data.employmentType,
          workLocation: data.workLocation,
          shift: data.shift,
          joiningDate: data.joiningDate.toISOString(),
          managerId: data.managerId,
          employeeStatus: data.employeeStatus,
        },
        requestContext,
        metadata: { operation: "profile_update", employeeCode: existing.employeeCode },
      }, tx);

      if (existing.department !== data.department) {
        await writeAuditLog({
          entityType: "employee",
          entityId: String(data.id),
          action: AUDIT_ACTIONS.EMPLOYEE_DEPARTMENT_CHANGED,
          actorUserId: session.id,
          actorEmail: session.email,
          employeeId: data.id,
          module: "employees",
          oldValue: { department: existing.department },
          newValue: { department: data.department },
          requestContext,
        }, tx);
      }

      if (previousManagerId !== data.managerId) {
        await writeAuditLog({
          entityType: "employee",
          entityId: String(data.id),
          action: data.managerId === null
            ? AUDIT_ACTIONS.EMPLOYEE_MANAGER_REMOVED
            : AUDIT_ACTIONS.EMPLOYEE_MANAGER_ASSIGNED,
          actorUserId: session.id,
          actorEmail: session.email,
          employeeId: data.id,
          module: "employees",
          oldValue: { managerId: previousManagerId },
          newValue: { managerId: data.managerId },
          requestContext,
        }, tx);
      }
    });
    if (
      existing.user &&
      existing.employeeStatus !== data.employeeStatus &&
      data.employeeStatus !== "Active"
    ) {
      await invalidateUserSessions(existing.user.id);
    }

    revalidatePath(`/admin/employees/${data.id}`);
    revalidatePath("/admin/employees");
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
