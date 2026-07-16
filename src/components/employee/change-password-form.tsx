"use client";

import { useActionState } from "react";
import { changePasswordAction, type PasswordActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";

const initial: PasswordActionState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initial
  );

  return (
    <SectionCard title="Security" description="Change your account login password">
      <form action={formAction} className="space-y-4 max-w-md">
        {state.error && <ErrorAlert message={state.error} />}
        {state.success && (
          <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success font-medium">
            {state.success}
          </p>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground block" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            required
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground block" htmlFor="newPassword">
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground block" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}
