import { describe, expect, it } from "vitest";
import { ApproverRole } from "@/generated/prisma/enums";
import { getApproverRoleLabel } from "@/lib/workflow/approver-role-labels";

describe("getApproverRoleLabel", () => {
  it("maps enum values to product labels", () => {
    expect(getApproverRoleLabel(ApproverRole.manager)).toBe("Team Lead");
    expect(getApproverRoleLabel(ApproverRole.skip_level_manager)).toBe("Manager");
    expect(getApproverRoleLabel(ApproverRole.hr_admin)).toBe("HR");
  });

  it("maps string role values", () => {
    expect(getApproverRoleLabel("manager")).toBe("Team Lead");
    expect(getApproverRoleLabel("skip_level_manager")).toBe("Manager");
    expect(getApproverRoleLabel("hr_admin")).toBe("HR");
  });
});
