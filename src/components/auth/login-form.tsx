"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type AuthState } from "@/actions/auth";
import { MicrosoftSignInButton } from "@/components/auth/microsoft-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ui/error-alert";

const initialState: AuthState = {};

const SSO_ERROR_MESSAGES: Record<string, string> = {
  sso_disabled: "Microsoft sign-in is not configured for this environment.",
  sso_denied: "Microsoft sign-in was cancelled or could not be completed.",
  rate_limited: "Too many sign-in attempts. Please wait and try again.",
  unknown_user: "No AMS account is provisioned for this Microsoft identity. Contact HR.",
  account_conflict: "This Microsoft account conflicts with an existing AMS user.",
  tenant_mismatch: "Your organization is not authorized to use this application.",
  invalid_token: "Microsoft returned an invalid identity token.",
};

function resolveSsoError(code: string | null, description: string | null): string | null {
  if (!code) return null;
  if (description && description.length > 0) return description;
  return SSO_ERROR_MESSAGES[code] ?? "Sign-in failed. Please try again.";
}

export function LoginForm({ microsoftEnabled }: { microsoftEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const searchParams = useSearchParams();
  const ssoError = resolveSsoError(
    searchParams.get("error"),
    searchParams.get("error_description")
  );
  const returnTo = searchParams.get("from") ?? undefined;
  const displayError = state.error ?? ssoError;

  return (
    <div className="space-y-6">
      {microsoftEnabled && (
        <div className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-card">
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Use your organization Microsoft account
          </p>
          <MicrosoftSignInButton returnTo={returnTo} enabled={microsoftEnabled} />
        </div>
      )}

      {microsoftEnabled && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
          </div>
        </div>
      )}

      <form
        action={formAction}
        className="space-y-4 rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-card"
      >
        {displayError && <ErrorAlert message={displayError} />}
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" variant={microsoftEnabled ? "outline" : "default"} className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in with email"}
        </Button>
      </form>
    </div>
  );
}
