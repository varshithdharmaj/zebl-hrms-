import { getSession } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/redirect-login";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) return redirectToLogin();

  return children;
}
