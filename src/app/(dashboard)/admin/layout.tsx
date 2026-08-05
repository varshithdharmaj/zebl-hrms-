import { AppShell } from "@/components/layout/app-shell";
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
      {children}
    </AppShell>
  );
}
