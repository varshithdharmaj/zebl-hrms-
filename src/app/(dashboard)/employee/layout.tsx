import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/redirect-login";
import { canAccessEmployeeShell } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role)) return redirectToLogin();

  // Surface the Team Approvals nav only to line-managers (those with direct reports).
  const directReports = session.employeeId
    ? await prisma.employee.count({ where: { managerId: session.employeeId } })
    : 0;

  return (
    <AppShell user={session} variant="wide" showApprovals={directReports > 0}>
      {children}
    </AppShell>
  );
}
