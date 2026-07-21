import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/employee/change-password-form";
import { getSession } from "@/lib/auth";

export default async function RequiredPasswordChangePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <p className="text-sm font-semibold text-primary">Account security</p>
          <h1 className="text-2xl font-bold tracking-tight">Change your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {session.mustChangePassword
              ? "An administrator requires you to choose a new password before continuing."
              : "Update your account password."}
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    </main>
  );
}
