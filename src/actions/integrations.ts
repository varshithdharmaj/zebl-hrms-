"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth-guards";
import { clearGraphTokenCache, getGraphAccessToken } from "@/lib/microsoft/graph-auth";
import { checkGraphHealth } from "@/lib/microsoft/graph-client";
import { processIntegrationJobs } from "@/lib/integrations/integration-worker";
import { enqueueIntegrationJob } from "@/lib/integrations/integration-queue";
import { getIntegrationSettings } from "@/lib/integrations/integration-settings";

export type IntegrationActionState = {
  error?: string;
  success?: string;
};

export async function getIntegrationSettingsAction() {
  await requireAdminSession();
  return getIntegrationSettings();
}

export async function updateIntegrationSettingsAction(
  _prev: IntegrationActionState,
  formData: FormData
): Promise<IntegrationActionState> {
  try {
    await requireAdminSession();

    const teamsWebhookUrl = String(formData.get("teamsWebhookUrl") ?? "").trim() || null;
    const escalationHours = parseInt(String(formData.get("escalationHours") ?? "24"), 10);

    await prisma.integrationSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        teamsWebhookUrl,
        teamsApprovalsEnabled: formData.get("teamsApprovalsEnabled") === "on",
        calendarSyncEnabled: formData.get("calendarSyncEnabled") === "on",
        orgSyncEnabled: formData.get("orgSyncEnabled") === "on",
        escalationHours: Number.isNaN(escalationHours) ? 24 : escalationHours,
        orgSyncPolicy: String(formData.get("orgSyncPolicy") ?? "{}"),
      },
      update: {
        teamsWebhookUrl,
        teamsApprovalsEnabled: formData.get("teamsApprovalsEnabled") === "on",
        calendarSyncEnabled: formData.get("calendarSyncEnabled") === "on",
        orgSyncEnabled: formData.get("orgSyncEnabled") === "on",
        escalationHours: Number.isNaN(escalationHours) ? 24 : escalationHours,
        orgSyncPolicy: String(formData.get("orgSyncPolicy") ?? "{}"),
      },
    });

    revalidatePath("/admin/integrations");
    return { success: "Integration settings saved." };
  } catch {
    return { error: "Failed to save integration settings." };
  }
}

export async function runGraphHealthCheckAction(): Promise<IntegrationActionState> {
  try {
    await requireAdminSession();
    clearGraphTokenCache();
    const token = await getGraphAccessToken(true);
    if (!token) {
      await prisma.integrationSettings.update({
        where: { id: "default" },
        data: {
          graphLastHealthAt: new Date(),
          graphLastHealthStatus: "error: not configured",
        },
      });
      revalidatePath("/admin/integrations");
      return { error: "Graph API credentials are not configured." };
    }

    const health = await checkGraphHealth();
    await prisma.integrationSettings.update({
      where: { id: "default" },
      data: {
        graphLastHealthAt: new Date(),
        graphLastHealthStatus: health.ok ? "ok" : `error: ${health.message}`,
      },
    });

    revalidatePath("/admin/integrations");
    return { success: health.message };
  } catch {
    return { error: "Graph health check failed." };
  }
}

export async function runIntegrationJobsAction(): Promise<IntegrationActionState> {
  try {
    await requireAdminSession();
    const result = await processIntegrationJobs({ limit: 50 });
    revalidatePath("/admin/integrations");
    return {
      success: `Processed ${result.processed} job(s): ${result.completed} completed, ${result.failed} failed.`,
    };
  } catch {
    return { error: "Failed to process integration jobs." };
  }
}

export async function queueOrgSyncAction(): Promise<IntegrationActionState> {
  try {
    await requireAdminSession();
    await enqueueIntegrationJob({
      jobType: "org_sync",
      payload: {},
      correlationId: `org-sync-${Date.now()}`,
    });
    revalidatePath("/admin/integrations");
    return { success: "Organization sync queued." };
  } catch {
    return { error: "Failed to queue org sync." };
  }
}
