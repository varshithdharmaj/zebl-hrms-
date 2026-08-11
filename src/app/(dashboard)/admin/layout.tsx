import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ListPageSkeleton } from "@/components/loading";
import { getSession } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/redirect-login";
import { canAccessAdmin } from "@/lib/permissions";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";
import {
  canAccessRecruitmentAdministration,
  isRecruitmentTestManager,
} from "@/lib/recruitment/permissions/recruitment-test-manager";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) return redirectToLogin();

  const isAdmin = canAccessAdmin(session.role);
  const isRecruitmentOpsTestManager = isRecruitmentTestManager(session);
  if (!isAdmin && !isRecruitmentOpsTestManager) return redirectToLogin();

  const showRecruitmentNav =
    isRecruitmentModuleEnabled() &&
    (isAdmin || canAccessRecruitmentAdministration(session));

  return (
    <AppShell
      user={session}
      variant="wide"
      showRecruitmentNav={showRecruitmentNav}
      recruitmentOpsOnly={!isAdmin && isRecruitmentOpsTestManager}
    >
      {/*
        Stable Suspense in the shared layout (not only leaf loading.tsx).
        Soft navigations keep showing the previous page unless an already-mounted
        Suspense boundary can reveal a fallback while the destination RSC streams.
      */}
      <Suspense
        fallback={<ListPageSkeleton label="Loading admin workspace" showKpis />}
      >
        {children}
      </Suspense>
    </AppShell>
  );
}
