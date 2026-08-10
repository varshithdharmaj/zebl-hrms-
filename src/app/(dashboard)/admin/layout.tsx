import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ListPageSkeleton } from "@/components/loading";
import { getSession } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/redirect-login";
import { canAccessAdmin } from "@/lib/permissions";
import { isRecruitmentModuleEnabled } from "@/lib/recruitment/config/feature-flags";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessAdmin(session.role)) return redirectToLogin();

  return (
    <AppShell
      user={session}
      variant="wide"
      showRecruitmentNav={isRecruitmentModuleEnabled()}
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
