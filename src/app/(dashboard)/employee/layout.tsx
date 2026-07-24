import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/redirect-login";
import { canAccessEmployeeShell } from "@/lib/permissions";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessEmployeeShell(session.role)) return redirectToLogin();

  // Team Approvals nav is presentation-only (resolved after paint via deferApprovalsNav).
  // Authorization for /employee/approvals remains hierarchy-based on that page.
  return (
    <AppShell user={session} variant="wide" deferApprovalsNav>
      {children}
    </AppShell>
  );
}
