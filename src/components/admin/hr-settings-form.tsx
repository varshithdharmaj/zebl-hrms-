"use client";

import { useActionState } from "react";
import {
  updateHrSettingsAction,
  type SettingsActionState,
} from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";

const initial: SettingsActionState = {};

export function HrSettingsForm({
  settings,
}: {
  settings: {
    escalationHours: number;
    teamsApprovalsEnabled: boolean;
    calendarSyncEnabled: boolean;
    orgSyncEnabled: boolean;
    teamsWebhookUrl: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(updateHrSettingsAction, initial);

  return (
    <form action={formAction} className="space-y-6 max-w-xl">
      <SectionCard title="Workflow & escalation" description="SLA used for approval inbox indicators">
        <label className="block text-sm font-medium">
          Escalation threshold (hours)
          <Input
            name="escalationHours"
            type="number"
            min={1}
            max={168}
            defaultValue={settings.escalationHours}
            className="mt-1"
          />
        </label>
      </SectionCard>

      <SectionCard title="Integrations">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="teamsApprovalsEnabled"
            defaultChecked={settings.teamsApprovalsEnabled}
          />
          Teams approval cards
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="calendarSyncEnabled"
            defaultChecked={settings.calendarSyncEnabled}
          />
          Outlook calendar sync
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="orgSyncEnabled" defaultChecked={settings.orgSyncEnabled} />
          Organization sync (Graph)
        </label>
        <label className="mt-4 block text-sm font-medium">
          Teams webhook URL
          <Input
            name="teamsWebhookUrl"
            type="url"
            defaultValue={settings.teamsWebhookUrl ?? ""}
            placeholder="https://..."
            className="mt-1"
          />
        </label>
      </SectionCard>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
      {state.success && <p className="text-sm text-success">{state.success}</p>}
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
