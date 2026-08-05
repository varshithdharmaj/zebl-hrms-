import type { SettingsRepository } from "@/lib/recruitment/repositories/settings-repository";

/**
 * Settings service — Phase 1 exposes the contract only.
 * Prisma implementation lands with the settings phase; callers inject a repository.
 */
export function createRecruitmentSettingsService(repository: SettingsRepository) {
  return {
    getSettings: () => repository.getSettings(),
    updateSettings: (
      patch: Record<string, unknown>,
      tx?: Parameters<SettingsRepository["updateSettings"]>[1]
    ) => repository.updateSettings(patch, tx),
    listTemplates: () => repository.listTemplates(),
    getTemplateWithStages: (templateId: string) =>
      repository.getTemplateWithStages(templateId),
  };
}

export type RecruitmentSettingsService = ReturnType<typeof createRecruitmentSettingsService>;
