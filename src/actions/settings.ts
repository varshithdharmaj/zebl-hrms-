"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth-guards";
import { getIntegrationSettings } from "@/lib/integrations/integration-settings";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS, writeAuditLog } from "@/lib/audit";

export type SettingsActionState = {
  error?: string;
  success?: string;
};

export async function getHrSettingsAction() {
  await requireAdminSession();
  return getIntegrationSettings();
}

export async function updateHrSettingsAction(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  try {
    const session = await requireAdminSession();

    const escalationHours = parseInt(String(formData.get("escalationHours") ?? "24"), 10);
    const teamsApprovalsEnabled = formData.get("teamsApprovalsEnabled") === "on";
    const calendarSyncEnabled = formData.get("calendarSyncEnabled") === "on";
    const orgSyncEnabled = formData.get("orgSyncEnabled") === "on";
    const teamsWebhookUrl = String(formData.get("teamsWebhookUrl") ?? "").trim() || null;

    if (Number.isNaN(escalationHours) || escalationHours < 1 || escalationHours > 168) {
      return { error: "Escalation hours must be between 1 and 168." };
    }

    await prisma.integrationSettings.update({
      where: { id: "default" },
      data: {
        escalationHours,
        teamsApprovalsEnabled,
        calendarSyncEnabled,
        orgSyncEnabled,
        teamsWebhookUrl,
      },
    });

    await writeAuditLog({
      entityType: "settings",
      entityId: "default",
      action: AUDIT_ACTIONS.EMPLOYEE_UPDATED,
      actorUserId: session.id,
      actorEmail: session.email,
      metadata: {
        operation: "hr_settings_update",
        escalationHours,
        teamsApprovalsEnabled,
        calendarSyncEnabled,
      },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/operations");

    return { success: "Settings saved." };
  } catch {
    return { error: "Failed to save settings." };
  }
}
