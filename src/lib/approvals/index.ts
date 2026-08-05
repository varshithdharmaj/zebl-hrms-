export type {
  ApprovalActPayload,
  ApprovalActResult,
  ApprovalAdapter,
  ApprovalCase,
  ApprovalCaseAction,
  ApprovalCaseStatus,
  ApprovalCaseType,
} from "@/lib/approvals/types";
export {
  parseLeaveCaseId,
  toLeaveCaseId,
} from "@/lib/approvals/types";
export {
  clearApprovalRegistryForTests,
  getApprovalAdapter,
  listRegisteredApprovalCaseTypes,
  parseCaseType,
  registerApprovalAdapter,
} from "@/lib/approvals/registry";
export { LeaveApprovalAdapter, mapLeaveToApprovalCase } from "@/lib/approvals/leave-adapter";
export type { PendingApprovalItem } from "@/lib/approvals/leave-inbox-types";
export {
  actOnApprovalCase,
  ensureApprovalCenterRegistered,
  listApprovalCenterCases,
  listLeaveApprovalInboxItems,
  resetApprovalCenterRegistrationForTests,
} from "@/lib/approvals/approval-center-service";
