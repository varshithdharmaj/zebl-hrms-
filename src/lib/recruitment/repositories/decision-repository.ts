import type { RepositoryTx } from "@/lib/recruitment/repositories/types";

/** Contract only — decision phase implements. */
export type DecisionRepository = {
  appendDecision(
    data: Record<string, unknown>,
    tx?: RepositoryTx
  ): Promise<{ id: string; version: number }>;
  findCurrent(applicationId: string): Promise<Record<string, unknown> | null>;
  listByApplication(applicationId: string): Promise<readonly Record<string, unknown>[]>;
};
