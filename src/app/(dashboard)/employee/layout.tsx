import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPageSkeleton } from "@/components/loading";
import { getSession } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/redirect-login";
import { canAccessHRAdministration, canAccessOwnWorkspace } from "@/lib/permissions";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import { hasPanelistInterviewAssignment } from "@/lib/recruitment/interview/queries";
import { isRecruitmentTestManager } from "@/lib/recruitment/permissions/recruitment-test-manager";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessOwnWorkspace(session.role, session.employeeId)) return redirectToLogin();

  const recruitmentOn = isRecruitmentModuleEnabled();
  const showPanelistInterviews =
    recruitmentOn && (await hasPanelistInterviewAssignment(session.employeeId));

  // My Team nav is presentation-only (resolved after paint via deferMyTeamNav).
  // Authorization for /employee/approvals remains hierarchy-based on that page.
  return (
    <AppShell
      user={session}
      variant="wide"
      deferMyTeamNav
      showPanelistInterviews={showPanelistInterviews}
      showRecruitmentNav={recruitmentOn && isRecruitmentTestManager(session)}
      showOwnWorkspaceNav={canAccessHRAdministration(session.role)}
    >
      <Suspense
        fallback={
          <DashboardPageSkeleton
            label="Loading employee workspace"
            kpiCount={3}
            showTable={false}
          />
        }
      >
        {children}
      </Suspense>
    </AppShell>
  );
}
