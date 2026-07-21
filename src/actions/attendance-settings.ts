"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminSession } from "@/lib/auth-guards";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";
import { parseWithSchema, safeParseWithSchema } from "@/lib/validation/parse";
import {
  weeklyScheduleSchema,
  dateOverrideCreateSchema,
  dateOverrideRemoveSchema,
} from "@/lib/validation/schemas/attendance-settings";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";
import { startOfDay } from "@/lib/utils";

export type AttendanceSettingsActionState = {
  error?: string;
  success?: string;
};

export async function updateWeeklyScheduleAction(
  _prev: AttendanceSettingsActionState,
  formData: FormData
): Promise<AttendanceSettingsActionState> {
  let session;
  try {
    session = await requireSuperAdminSession();
  } catch {
    return { error: "Only Super Admin may modify the attendance schedule." };
  }

  const parsed = parseWithSchema(weeklyScheduleSchema, {
    mondayWorking: formData.get("mondayWorking"),
    tuesdayWorking: formData.get("tuesdayWorking"),
    wednesdayWorking: formData.get("wednesdayWorking"),
    thursdayWorking: formData.get("thursdayWorking"),
    fridayWorking: formData.get("fridayWorking"),
    saturdayWorking: formData.get("saturdayWorking"),
    sundayWorking: formData.get("sundayWorking"),
    expectedWorkMinutes: formData.get("expectedWorkMinutes"),
  });

  await prisma.attendanceSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...parsed },
    update: { ...parsed },
  });

  await writeAuditLog({
    entityType: "attendance_settings",
    entityId: "default",
    action: AUDIT_ACTIONS.ATTENDANCE_SETTINGS_UPDATED,
    actorUserId: session.id,
    actorEmail: session.email,
    metadata: { ...parsed },
  });

  revalidatePath("/admin/attendance-settings");
  revalidatePath("/employee/dashboard");

  return { success: "Attendance schedule saved." };
}

export async function createDateOverrideAction(
  _prev: AttendanceSettingsActionState,
  formData: FormData
): Promise<AttendanceSettingsActionState> {
  let session;
  try {
    session = await requireSuperAdminSession();
  } catch {
    return { error: "Only Super Admin may modify attendance date overrides." };
  }

  const validated = safeParseWithSchema(dateOverrideCreateSchema, {
    date: formData.get("date"),
    type: formData.get("type"),
    reason: formData.get("reason") || undefined,
  });
  if (!validated.ok) return { error: validated.error };

  const { date, type, reason } = validated.data;
  const parsedDate = startOfDay(new Date(date + "T00:00:00"));
  if (Number.isNaN(parsedDate.getTime())) return { error: "Invalid date." };

  try {
    const override = await prisma.attendanceDateOverride.create({
      data: {
        date: parsedDate,
        type,
        reason: reason?.trim() || null,
        createdBy: session.id,
      },
    });

    await writeAuditLog({
      entityType: "attendance_date_override",
      entityId: String(override.id),
      action: AUDIT_ACTIONS.ATTENDANCE_DATE_OVERRIDE_CREATED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: { date, type, reason: reason ?? null },
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      return { error: "An override already exists for this date." };
    }
    throw e;
  }

  revalidatePath("/admin/attendance-settings");
  revalidatePath("/employee/dashboard");

  return { success: "Date override added." };
}

export async function removeDateOverrideAction(
  _prev: AttendanceSettingsActionState,
  formData: FormData
): Promise<AttendanceSettingsActionState> {
  let session;
  try {
    session = await requireSuperAdminSession();
  } catch {
    return { error: "Only Super Admin may modify attendance date overrides." };
  }

  const validated = safeParseWithSchema(dateOverrideRemoveSchema, { id: formData.get("id") });
  if (!validated.ok) return { error: validated.error };

  const existing = await prisma.attendanceDateOverride.findUnique({
    where: { id: validated.data.id },
  });
  if (!existing) return { error: "Override not found." };

  await prisma.attendanceDateOverride.delete({ where: { id: validated.data.id } });

  await writeAuditLog({
    entityType: "attendance_date_override",
    entityId: String(existing.id),
    action: AUDIT_ACTIONS.ATTENDANCE_DATE_OVERRIDE_REMOVED,
    actorUserId: session.id,
    actorEmail: session.email,
    metadata: { date: existing.date.toISOString().split("T")[0], type: existing.type },
  });

  revalidatePath("/admin/attendance-settings");
  revalidatePath("/employee/dashboard");

  return { success: "Date override removed." };
}
