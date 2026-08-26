import { ApproverRole, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getManager } from "@/lib/org";
import { sanitizeEmail } from "@/lib/notifications/sanitize";

export type ResolvedRecipient = {
  email: string;
  userId?: string;
  name?: string;
  role?: string;
};

export async function getEmployeeUserEmail(employeeId: number): Promise<ResolvedRecipient | null> {
  const user = await prisma.user.findFirst({
    where: { employeeId },
    select: { id: true, email: true, employee: { select: { name: true } } },
  });
  if (!user) {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { email: true, name: true },
    });
    const email = emp?.email ? sanitizeEmail(emp.email) : null;
    if (!email) return null;
    return { email, name: emp?.name };
  }
  return {
    email: user.email,
    userId: user.id,
    name: user.employee?.name,
  };
}

export async function getApproverEmail(approverId: number): Promise<ResolvedRecipient | null> {
  const emp = await prisma.employee.findUnique({
    where: { id: approverId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!emp) return null;
  const email = emp.user?.email ?? (emp.email ? sanitizeEmail(emp.email) : null);
  if (!email) return null;
  return {
    email,
    userId: emp.user?.id,
    name: emp.name,
  };
}

export async function getHrRecipients(): Promise<ResolvedRecipient[]> {
  const users = await prisma.user.findMany({
    where: { role: { in: [UserRole.admin, UserRole.hr_admin] } },
    select: { id: true, email: true },
  });
  return users.map((u) => ({ email: u.email, userId: u.id, role: "hr" }));
}

export async function resolveManagerForEmployee(
  employeeId: number
): Promise<ResolvedRecipient | null> {
  const manager = await getManager(employeeId);
  if (!manager) return null;
  return getApproverEmail(manager.id);
}

export async function resolveCurrentStepApprover(
  leaveRequestId: number
): Promise<ResolvedRecipient | null> {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      currentStep: { include: { approver: { include: { user: true } } } },
    },
  });
  if (!leave?.currentStep) return null;

  if (leave.currentStep.approverRole === ApproverRole.hr_admin) {
    const hr = await getHrRecipients();
    return hr[0] ?? null;
  }

  if (leave.currentStep.approverId) {
    return getApproverEmail(leave.currentStep.approverId);
  }

  return null;
}

export function shouldNotifyHrOnSubmit(): boolean {
  return process.env.NOTIFY_HR_ON_SUBMIT !== "false";
}
