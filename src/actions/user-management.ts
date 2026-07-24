"use server";

import { revalidatePath } from "next/cache";
import {
  requireHROrSuperAdminSession,
  requireSuperAdminSession,
} from "@/lib/auth-guards";
import {
  changeUserRole,
  provisionEmployeeLogin,
  resetUserPassword,
  setUserActive,
  updateUserAccountStatus,
  updateUserIdentity,
  UserManagementError,
} from "@/lib/admin/user-management";
import { isAppUserRole } from "@/lib/roles";
import {
  accountIdentityUpdateSchema,
  accountStatusUpdateSchema,
  passwordResetSchema,
  provisionEmployeeLoginSchema,
} from "@/lib/validation/schemas/employee-account";
import { safeParseWithSchema } from "@/lib/validation/parse";

export type ActionState = {
  error?: string;
  success?: string;
  temporaryPassword?: string;
};

export async function changeUserRoleAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSuperAdminSession();
    const targetUserId = String(formData.get("userId") ?? "");
    const newRole = String(formData.get("role") ?? "");

    if (!targetUserId) return { error: "Invalid user." };
    if (!isAppUserRole(newRole)) return { error: "Invalid role." };

    await changeUserRole(session, targetUserId, newRole);
    revalidatePath("/admin/user-management");
    revalidatePath("/admin/employees");
    return { success: "Role updated." };
  } catch (e) {
    return { error: e instanceof UserManagementError ? e.message : "Failed to update role." };
  }
}

export async function resetUserPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(passwordResetSchema, {
      userId: formData.get("userId"),
      mode: formData.get("mode"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
      mustChangePassword: formData.get("mustChangePassword") === "on",
    });
    if (!parsed.ok) return { error: parsed.error };
    const result = await resetUserPassword(session, {
      userId: parsed.data.userId,
      password: parsed.data.password,
      generate: parsed.data.mode === "generated",
      mustChangePassword: parsed.data.mustChangePassword,
    });
    revalidatePath("/admin/user-management");
    revalidatePath("/admin/employees");
    return {
      success: "Password reset. Existing sessions were revoked.",
      temporaryPassword: result.temporaryPassword,
    };
  } catch (error) {
    return {
      error: error instanceof UserManagementError ? error.message : "Failed to reset password.",
    };
  }
}

export async function updateAccountStatusAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(accountStatusUpdateSchema, {
      userId: formData.get("userId"),
      status: formData.get("status"),
      reason: formData.get("reason"),
    });
    if (!parsed.ok) return { error: parsed.error };
    await updateUserAccountStatus(
      session,
      parsed.data.userId,
      parsed.data.status,
      parsed.data.reason
    );
    revalidatePath("/admin/user-management");
    revalidatePath("/admin/employees");
    return { success: `Account status changed to ${parsed.data.status}.` };
  } catch (error) {
    return {
      error: error instanceof UserManagementError ? error.message : "Failed to update account status.",
    };
  }
}

export async function updateUserIdentityAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(accountIdentityUpdateSchema, {
      userId: formData.get("userId"),
      username: formData.get("username"),
      email: formData.get("email"),
      profilePhotoUrl: formData.get("profilePhotoUrl"),
    });
    if (!parsed.ok) return { error: parsed.error };
    await updateUserIdentity(session, {
      userId: parsed.data.userId,
      username: parsed.data.username || null,
      email: parsed.data.email,
      profilePhotoUrl: parsed.data.profilePhotoUrl || null,
    });
    revalidatePath("/admin/user-management");
    return { success: "Account information updated." };
  } catch (error) {
    return {
      error: error instanceof UserManagementError ? error.message : "Failed to update account.",
    };
  }
}

export async function setUserActiveAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireSuperAdminSession();
    const targetUserId = String(formData.get("userId") ?? "");
    const isActive = String(formData.get("isActive") ?? "") === "true";

    if (!targetUserId) return { error: "Invalid user." };

    await setUserActive(session, targetUserId, isActive);
    revalidatePath("/admin/user-management");
    return { success: isActive ? "User activated." : "User deactivated." };
  } catch (e) {
    return {
      error: e instanceof UserManagementError ? e.message : "Failed to update user status.",
    };
  }
}

export async function provisionEmployeeLoginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(provisionEmployeeLoginSchema, {
      employeeId: formData.get("employeeId"),
      mode: formData.get("mode"),
      email: formData.get("email"),
      existingUserId: formData.get("existingUserId"),
      passwordMode: formData.get("passwordMode") || "generated",
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
      mustChangePassword: formData.get("mustChangePassword") === "on",
    });
    if (!parsed.ok) return { error: parsed.error };

    // Ignore any client-supplied role — provisioning always targets employee-role accounts.
    const result = await provisionEmployeeLogin(session, {
      employeeId: parsed.data.employeeId,
      mode: parsed.data.mode,
      email: parsed.data.email || undefined,
      existingUserId: parsed.data.existingUserId || undefined,
      password: parsed.data.password,
      generate: parsed.data.mode === "create" && parsed.data.passwordMode === "generated",
      mustChangePassword: parsed.data.mustChangePassword,
    });

    revalidatePath("/admin/user-management");
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${parsed.data.employeeId}`);

    return {
      success:
        parsed.data.mode === "link"
          ? "Existing login linked to this employee."
          : "Employee login created.",
      temporaryPassword: result.temporaryPassword,
    };
  } catch (error) {
    return {
      error:
        error instanceof UserManagementError
          ? error.message
          : "Failed to provision employee login.",
    };
  }
}
