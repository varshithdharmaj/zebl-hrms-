import type { RepositoryTx } from "@/lib/recruitment/repositories/types";

/** Contract only — settings phase implements. */
export type SettingsRepository = {
  getSettings(): Promise<Record<string, unknown> | null>;
  updateSettings(patch: Record<string, unknown>, tx?: RepositoryTx): Promise<void>;
  createTemplate(
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string }>;
  updateTemplate(
    templateId: string,
    patch: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<void>;
  listTemplates(): Promise<readonly Record<string, unknown>[]>;
  getTemplateWithStages(templateId: string): Promise<Record<string, unknown> | null>;
};
