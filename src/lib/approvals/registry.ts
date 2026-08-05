import type { ApprovalAdapter, ApprovalCaseType } from "@/lib/approvals/types";

const adapters = new Map<ApprovalCaseType, ApprovalAdapter>();

export function registerApprovalAdapter(adapter: ApprovalAdapter): void {
  adapters.set(adapter.caseType, adapter);
}

export function getApprovalAdapter(caseType: ApprovalCaseType): ApprovalAdapter | null {
  return adapters.get(caseType) ?? null;
}

export function listRegisteredApprovalCaseTypes(): ApprovalCaseType[] {
  return [...adapters.keys()];
}

export function parseCaseType(caseId: string): ApprovalCaseType | null {
  const type = caseId.split(":")[0];
  if (!type) return null;
  if (
    type === "leave" ||
    type === "offer" ||
    type === "expense" ||
    type === "asset" ||
    type === "performance" ||
    type === "travel"
  ) {
    return type;
  }
  return null;
}

/** Test helper — clears the registry between suites. */
export function clearApprovalRegistryForTests(): void {
  adapters.clear();
}
