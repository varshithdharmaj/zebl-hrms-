/**
 * Backfill workflow fields and approval steps for existing leave requests.
 * Run: npm run db:migrate-phase2
 */
import {
  ApprovalStepStatus,
  ApproverRole,
  LeaveRequestStatus,
  LeaveWorkflowStatus,
  PrismaClient,
} from "@prisma/client";
import { buildApprovalChain } from "../../src/lib/workflow/approval-routing";
import { workflowToLeaveStatus } from "../../src/lib/workflow/workflow-status";

const prisma = new PrismaClient();

async function main() {
  const leaves = await prisma.leaveRequest.findMany({
    include: { approvalSteps: true },
  });

  let migrated = 0;

  for (const leave of leaves) {
    const hasSteps = leave.approvalSteps.length > 0;

    if (!leave.submittedAt) {
      await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: { submittedAt: leave.createdAt },
      });
    }

    if (leave.status === LeaveRequestStatus.approved && !leave.finalApprovedAt) {
      await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: {
          workflowStatus: LeaveWorkflowStatus.approved,
          finalApprovedAt: leave.reviewedAt ?? leave.createdAt,
        },
      });
      continue;
    }

    if (leave.status === LeaveRequestStatus.rejected) {
      await prisma.leaveRequest.update({
        where: { id: leave.id },
        data: {
          workflowStatus: LeaveWorkflowStatus.rejected,
          rejectionReason: leave.rejectionReason ?? "Migrated rejection",
        },
      });
      continue;
    }

    if (hasSteps) continue;

    if (leave.status !== LeaveRequestStatus.pending) continue;

    const chain = await buildApprovalChain({
      employeeId: leave.employeeId,
      leaveDays: leave.days,
    });

    const steps = await Promise.all(
      chain.map((c) =>
        prisma.leaveApprovalStep.create({
          data: {
            leaveRequestId: leave.id,
            stepOrder: c.stepOrder,
            approverId: c.approverId,
            approverRole: c.approverRole,
            status: ApprovalStepStatus.pending,
          },
        })
      )
    );

    const first = steps[0];
    await prisma.leaveRequest.update({
      where: { id: leave.id },
      data: {
        workflowStatus: LeaveWorkflowStatus.pending_approval,
        status: workflowToLeaveStatus(LeaveWorkflowStatus.pending_approval),
        submittedAt: leave.submittedAt ?? leave.createdAt,
        currentStepId: first?.id ?? null,
      },
    });

    migrated += 1;
  }

  console.log(`Phase 2 workflow backfill complete. Migrated ${migrated} pending request(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
