import { getSession } from "@/lib/auth";
import { redirectToLogin } from "@/lib/auth/redirect-login";
import { sessionRequiresPasswordChange } from "@/lib/auth/password-change-gate";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) return redirectToLogin();
  if (sessionRequiresPasswordChange(session)) redirect("/change-password");

  return children;
}
