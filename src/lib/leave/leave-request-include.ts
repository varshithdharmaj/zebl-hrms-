import type { Prisma } from "@/generated/prisma/client";

/**
 * Canonical LeaveRequest include for workflow + list read models.
 * Keep relations in sync: employee, ordered approvalSteps, currentStep.
 */
export const leaveRequestWithStepsInclude = {
  employee: true,
  approvalSteps: {
    orderBy: { stepOrder: "asc" as const },
    include: { approver: true },
  },
  currentStep: { include: { approver: true } },
} satisfies Prisma.LeaveRequestInclude;
