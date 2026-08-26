import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { isMicrosoftAuthEnabled } from "@/lib/auth/auth-config";

export default function LoginPage() {
  const microsoftEnabled = isMicrosoftAuthEnabled();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-card">
          Z
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Zebl Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {microsoftEnabled
            ? "Enterprise sign-in for your organization"
            : "Sign in to your workspace"}
        </p>
      </div>
      <div className="w-full max-w-sm">
        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
          <LoginForm microsoftEnabled={microsoftEnabled} />
        </Suspense>
      </div>
    </div>
  );
}
