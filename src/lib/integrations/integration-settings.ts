import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/db/prisma-errors";

const DEFAULT_SETTINGS_ID = "default";

/**
 * Returns the singleton integration_settings row.
 * Uses find-or-create (not upsert) to avoid parallel upsert races on `id`.
 */
export const getIntegrationSettings = cache(async () => {
  const existing = await prisma.integrationSettings.findUnique({
    where: { id: DEFAULT_SETTINGS_ID },
  });
  if (existing) return existing;

  try {
    return await prisma.integrationSettings.create({
      data: { id: DEFAULT_SETTINGS_ID },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return prisma.integrationSettings.findUniqueOrThrow({
        where: { id: DEFAULT_SETTINGS_ID },
      });
    }
    throw error;
  }
});

export function getTeamsWebhookFromEnv(): string | undefined {
  return process.env.TEAMS_WEBHOOK_URL?.trim() || undefined;
}

export async function resolveTeamsWebhookUrl(): Promise<string | null> {
  const settings = await getIntegrationSettings();
  return settings.teamsWebhookUrl ?? getTeamsWebhookFromEnv() ?? null;
}

export async function isTeamsIntegrationEnabled(): Promise<boolean> {
  const webhook = await resolveTeamsWebhookUrl();
  return Boolean(webhook?.trim());
}

/** Sync check using env only (for startup guards without DB). */
export function isTeamsWebhookConfiguredInEnv(): boolean {
  return Boolean(process.env.TEAMS_WEBHOOK_URL?.trim());
}
