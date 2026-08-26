"use client";

import { useActionState } from "react";
import {
  updatePayrollSettingsAction,
  type PayrollActionState,
} from "@/actions/payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/section-card";
import { Textarea } from "@/components/ui/textarea";
import type { PayrollSettingsSnapshot } from "@/lib/payroll/payroll-types";

const initial: PayrollActionState = {};

export function PayrollSettingsForm({ settings }: { settings: PayrollSettingsSnapshot }) {
  const [state, formAction, pending] = useActionState(updatePayrollSettingsAction, initial);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <SectionCard
        title="Payroll cycle"
        description="Attendance summaries use payroll periods, not calendar months."
      >
        <label className="block text-sm font-medium">
          Payroll start day (of month)
          <Input
            name="payrollStartDay"
            type="number"
            min={1}
            max={28}
            defaultValue={settings.payrollStartDay}
            className="mt-1 max-w-[8rem]"
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Example: day 25 → Apr 25 to May 25.
        </p>
      </SectionCard>

      <SectionCard
        title="Required time"
        description="8h work + 1h break = 9h office presence (defaults)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Required work (minutes)
            <Input
              name="requiredWorkMinutes"
              type="number"
              min={60}
              defaultValue={settings.requiredWorkMinutes}
              className="mt-1"
            />
          </label>
          <label className="block text-sm font-medium">
            Break (minutes)
            <Input
              name="breakMinutes"
              type="number"
              min={0}
              defaultValue={settings.breakMinutes}
              className="mt-1"
            />
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Required office presence (minutes)
            <Input
              name="requiredOfficeMinutes"
              type="number"
              min={60}
              defaultValue={settings.requiredOfficeMinutes}
              className="mt-1"
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Thresholds & grace">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            OT threshold (minutes)
            <Input
              name="otThresholdMinutes"
              type="number"
              min={0}
              defaultValue={settings.otThresholdMinutes}
              className="mt-1"
            />
          </label>
          <label className="block text-sm font-medium">
            Half-day threshold (minutes)
            <Input
              name="halfDayThresholdMinutes"
              type="number"
              min={30}
              defaultValue={settings.halfDayThresholdMinutes}
              className="mt-1"
            />
          </label>
          <label className="block text-sm font-medium">
            Grace period (minutes)
            <Input
              name="graceMinutes"
              type="number"
              min={0}
              defaultValue={settings.graceMinutes}
              className="mt-1"
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Per-shift rules (optional)"
        description='JSON map by Employee.shift label, e.g. {"Night Shift":{"requiredOfficeMinutes":600}}'
      >
        <Textarea
          name="shiftRulesJson"
          rows={8}
          className="font-mono text-xs"
          defaultValue={JSON.stringify(settings.shiftRules, null, 2)}
        />
      </SectionCard>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save payroll settings"}
      </Button>
      {state.success && <p className="text-sm text-success">{state.success}</p>}
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
