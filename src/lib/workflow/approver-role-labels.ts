import { ApproverRole } from "@prisma/client";

/** Client-safe labels — do not import approval-routing.ts from client components. */
export function getApproverRoleLabel(role: ApproverRole | string): string {
  switch (role) {
    case ApproverRole.manager:
    case "manager":
      return "Direct manager";
    case ApproverRole.skip_level_manager:
    case "skip_level_manager":
      return "Skip-level manager";
    case ApproverRole.hr_admin:
    case "hr_admin":
      return "HR";
    default:
      return String(role);
  }
}
