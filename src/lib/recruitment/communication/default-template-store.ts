import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { RecruitmentEmailTemplateType } from "@/generated/prisma/enums";

const SETTINGS_ID = "default";
const META_KEY = "defaultEmailTemplates";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Default template IDs per type, persisted in RecruitmentSettings.metadata
 * (no schema rewrite).
 */
export async function getDefaultEmailTemplateMap(): Promise<
  Partial<Record<RecruitmentEmailTemplateType, string>>
> {
  const row = await prisma.recruitmentSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { metadata: true },
  });
  const meta = asRecord(row?.metadata);
  const defaults = asRecord(meta[META_KEY]);
  const result: Partial<Record<RecruitmentEmailTemplateType, string>> = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof value === "string" && value.trim()) {
      result[key as RecruitmentEmailTemplateType] = value;
    }
  }
  return result;
}

export async function setDefaultEmailTemplate(
  type: RecruitmentEmailTemplateType,
  templateId: string | null
): Promise<void> {
  const row = await prisma.recruitmentSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { metadata: true },
  });
  const meta = asRecord(row?.metadata);
  const defaults = { ...asRecord(meta[META_KEY]) };
  if (templateId) {
    defaults[type] = templateId;
  } else {
    delete defaults[type];
  }

  await prisma.recruitmentSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      metadata: { [META_KEY]: defaults } as unknown as Prisma.InputJsonValue,
    },
    update: {
      metadata: {
        ...meta,
        [META_KEY]: defaults,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}
