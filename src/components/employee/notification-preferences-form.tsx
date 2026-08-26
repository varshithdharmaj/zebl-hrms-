"use client";

import { useActionState } from "react";
import {
  updateNotificationPreferencesAction,
  type NotificationActionState,
} from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import type { NotificationPreference } from "@prisma/client";

const initial: NotificationActionState = {};

export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: NotificationPreference;
}) {
  const [state, formAction, pending] = useActionState(
    updateNotificationPreferencesAction,
    initial
  );

  return (
    <SectionCard title="Email notifications" description="Control which alerts you receive by email">
      <form action={formAction} className="space-y-4">
        {state.error && <ErrorAlert message={state.error} />}
        {state.success && (
          <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
            {state.success}
          </p>
        )}

        <PreferenceToggle
          name="emailEnabled"
          label="Enable email notifications"
          defaultChecked={preferences.emailEnabled}
        />
        <PreferenceToggle
          name="leaveApprovalAlerts"
          label="Leave approval alerts (when you are an approver)"
          defaultChecked={preferences.leaveApprovalAlerts}
        />
        <PreferenceToggle
          name="leaveStatusAlerts"
          label="Leave status updates (approved, rejected, etc.)"
          defaultChecked={preferences.leaveStatusAlerts}
        />
        <PreferenceToggle
          name="escalationAlerts"
          label="Escalation reminders (when available)"
          defaultChecked={preferences.escalationAlerts}
        />

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Microsoft collaboration</p>
          <PreferenceToggle
            name="teamsNotificationsEnabled"
            label="Microsoft Teams notifications"
            defaultChecked={preferences.teamsNotificationsEnabled}
          />
          <PreferenceToggle
            name="teamsApprovalCardsEnabled"
            label="Teams approval cards"
            defaultChecked={preferences.teamsApprovalCardsEnabled}
          />
          <PreferenceToggle
            name="calendarSyncEnabled"
            label="Outlook calendar sync for my approved leave"
            defaultChecked={preferences.calendarSyncEnabled}
          />
          <PreferenceToggle
            name="futurePushEnabled"
            label="Push notifications (coming soon)"
            defaultChecked={preferences.futurePushEnabled}
            disabled
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
      </form>
    </SectionCard>
  );
}

function PreferenceToggle({
  name,
  label,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-border"
      />
      <span className={`text-sm ${disabled ? "text-muted-foreground" : "text-foreground"}`}>
        {label}
      </span>
    </label>
  );
}
