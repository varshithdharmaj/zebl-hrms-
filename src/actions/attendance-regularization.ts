"use server";

import { revalidatePath } from "next/cache";
import { requireEmployeeSession, requireHROrSuperAdminSession } from "@/lib/auth-guards";
import { safeParseWithSchema } from "@/lib/validation/parse";
import {
  rejectRegularizationSchema,
  reviewRegularizationSchema,
  submitRegularizationSchema,
} from "@/lib/validation/schemas/attendance/regularization";
import {
  approveRegularizationRequest,
  cancelRegularizationRequest,
  rejectRegularizationRequest,
  RegularizationError,
  submitRegularizationRequest,
  type RegularizationActor,
} from "@/lib/attendance/regularization/regularization-service";
import { startOfDay } from "@/lib/utils";

export type ActionState = {
  error?: string;
  success?: string;
};

function parseAttendanceDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return startOfDay(new Date(year, month - 1, day));
}

export async function submitRegularizationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireEmployeeSession();

    const previousRequestIdRaw = String(formData.get("previousRequestId") ?? "").trim();
    const parsed = safeParseWithSchema(submitRegularizationSchema, {
      attendanceDate: String(formData.get("attendanceDate") ?? "").trim(),
      requestType: String(formData.get("requestType") ?? "").trim(),
      requestedCheckIn: String(formData.get("requestedCheckIn") ?? "").trim() || null,
      requestedCheckOut: String(formData.get("requestedCheckOut") ?? "").trim() || null,
      checkOutNextDay: formData.get("checkOutNextDay") === "on",
      reason: String(formData.get("reason") ?? "").trim(),
      previousRequestId: previousRequestIdRaw ? Number(previousRequestIdRaw) : undefined,
    });
    if (!parsed.ok) return { error: parsed.error };

    const actor: RegularizationActor = {
      userId: session.id,
      email: session.email,
      role: session.role as RegularizationActor["role"],
      employeeId: session.employeeId,
    };

    await submitRegularizationRequest({
      actor,
      attendanceDate: parseAttendanceDate(parsed.data.attendanceDate),
      requestType: parsed.data.requestType,
      requestedCheckIn: parsed.data.requestedCheckIn ?? null,
      requestedCheckOut: parsed.data.requestedCheckOut ?? null,
      checkOutNextDay: parsed.data.checkOutNextDay ?? false,
      reason: parsed.data.reason,
      previousRequestId: parsed.data.previousRequestId,
    });

    revalidatePath("/employee/attendance");
    return { success: "Regularisation request submitted." };
  } catch (error) {
    if (error instanceof RegularizationError) return { error: error.message };
    console.error("[submitRegularizationAction]", error);
    return { error: "Failed to submit regularisation request." };
  }
}

export async function cancelRegularizationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireEmployeeSession();
    const requestId = Number(formData.get("requestId"));
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return { error: "Invalid request." };
    }

    await cancelRegularizationRequest({
      actor: {
        userId: session.id,
        email: session.email,
        role: session.role as RegularizationActor["role"],
        employeeId: session.employeeId,
      },
      requestId,
    });

    revalidatePath("/employee/attendance");
    return { success: "Request cancelled." };
  } catch (error) {
    if (error instanceof RegularizationError) return { error: error.message };
    console.error("[cancelRegularizationAction]", error);
    return { error: "Failed to cancel request." };
  }
}

export async function approveRegularizationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(reviewRegularizationSchema, {
      requestId: Number(formData.get("requestId")),
      expectedVersion: Number(formData.get("expectedVersion")),
      reviewComment: String(formData.get("reviewComment") ?? "").trim() || undefined,
    });
    if (!parsed.ok) return { error: parsed.error };

    await approveRegularizationRequest({
      actor: {
        userId: session.id,
        email: session.email,
        role: session.role as RegularizationActor["role"],
        employeeId: session.employeeId,
      },
      requestId: parsed.data.requestId,
      expectedVersion: parsed.data.expectedVersion,
      reviewComment: parsed.data.reviewComment,
    });

    revalidatePath("/admin/attendance");
    return { success: "Request approved." };
  } catch (error) {
    if (error instanceof RegularizationError) return { error: error.message };
    console.error("[approveRegularizationAction]", error);
    return { error: "Failed to approve request." };
  }
}

export async function rejectRegularizationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const session = await requireHROrSuperAdminSession();
    const parsed = safeParseWithSchema(rejectRegularizationSchema, {
      requestId: Number(formData.get("requestId")),
      expectedVersion: Number(formData.get("expectedVersion")),
      reviewComment: String(formData.get("reviewComment") ?? "").trim(),
    });
    if (!parsed.ok) return { error: parsed.error };

    await rejectRegularizationRequest({
      actor: {
        userId: session.id,
        email: session.email,
        role: session.role as RegularizationActor["role"],
        employeeId: session.employeeId,
      },
      requestId: parsed.data.requestId,
      expectedVersion: parsed.data.expectedVersion,
      reviewComment: parsed.data.reviewComment,
    });

    revalidatePath("/admin/attendance");
    return { success: "Request rejected." };
  } catch (error) {
    if (error instanceof RegularizationError) return { error: error.message };
    console.error("[rejectRegularizationAction]", error);
    return { error: "Failed to reject request." };
  }
}
