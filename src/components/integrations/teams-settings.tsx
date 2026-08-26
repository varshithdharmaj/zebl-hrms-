"use client";

import { useActionState } from "react";
import {
  updateIntegrationSettingsAction,
  type IntegrationActionState,
} from "@/actions/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import type { IntegrationSettings } from "@prisma/client";

const initial: IntegrationActionState = {};

export function TeamsSettingsForm({ settings }: { settings: IntegrationSettings }) {
  const [state, formAction, pending] = useActionState(updateIntegrationSettingsAction, initial);

  return (
    <SectionCard
      title="Microsoft Teams"
      description="Incoming webhook for workflow notifications and adaptive approval cards"
    >
      <form action={formAction} className="space-y-4">
        {state.error && <ErrorAlert message={state.error} />}
        {state.success && (
          <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
            {state.success}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="teamsWebhookUrl">Teams incoming webhook URL</Label>
          <Input
            id="teamsWebhookUrl"
            name="teamsWebhookUrl"
            type="url"
            defaultValue={settings.teamsWebhookUrl ?? ""}
            placeholder="https://outlook.office.com/webhook/..."
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="teamsApprovalsEnabled"
            defaultChecked={settings.teamsApprovalsEnabled}
            className="h-4 w-4 rounded border-border"
          />
          Enable Teams approval cards (uses secure AMS approval links)
        </label>

        <div className="space-y-2">
          <Label htmlFor="escalationHours">Escalation threshold (hours)</Label>
          <Input
            id="escalationHours"
            name="escalationHours"
            type="number"
            min={1}
            max={168}
            defaultValue={settings.escalationHours}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="calendarSyncEnabled"
            defaultChecked={settings.calendarSyncEnabled}
            className="h-4 w-4 rounded border-border"
          />
          Outlook calendar sync (requires Graph API)
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="orgSyncEnabled"
            defaultChecked={settings.orgSyncEnabled}
            className="h-4 w-4 rounded border-border"
          />
          Organization directory sync
        </label>

        <div className="space-y-2">
          <Label htmlFor="orgSyncPolicy">Org sync policy (JSON)</Label>
          <Textarea
            id="orgSyncPolicy"
            name="orgSyncPolicy"
            className="min-h-[80px] font-mono text-xs"
            defaultValue={settings.orgSyncPolicy}
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save integration settings"}
        </Button>
      </form>
    </SectionCard>
  );
}
