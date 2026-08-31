"use client";

import { useActionState, useState } from "react";
import {
  updateLeavePolicySettingsAction,
  type LeavePolicySettingsActionState,
} from "@/actions/leave-policy-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import type { LeavePolicy } from "@/lib/leave/leave-policy";

const initialState: LeavePolicySettingsActionState = {};

export function LeaveSettingsView({
  settings,
  canEdit,
}: {
  settings: LeavePolicy;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateLeavePolicySettingsAction,
    initialState
  );
  const [slCarryForward, setSlCarryForward] = useState(settings.slCarryForward);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-lg border border-danger/20 bg-danger-muted px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm font-medium text-success">
          {state.success}
        </p>
      )}

      <SectionCard
        title="Leave cycle"
        description="The leave year runs from a fixed start day to the day before that same day next month (e.g. 26th → 25th)."
      >
        <div className="max-w-xs space-y-1">
          <Label htmlFor="cycleStartDay">Cycle start day</Label>
          <Input
            id="cycleStartDay"
            name="cycleStartDay"
            type="number"
            min={1}
            max={28}
            defaultValue={settings.cycleStartDay}
            disabled={!canEdit || pending}
          />
          <p className="text-xs text-muted-foreground">
            Day of the month a new leave cycle begins. Capped at 28 so it exists in every month.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Earned Leave (EL)"
        description="How Earned Leave is accrued, when employees become eligible, and how long unused EL stays valid."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="elAccrualAmount">Accrual per cycle (days)</Label>
            <Input
              id="elAccrualAmount"
              name="elAccrualAmount"
              type="number"
              step={0.5}
              min={0.5}
              defaultValue={settings.elAccrualAmount}
              disabled={!canEdit || pending}
            />
            <p className="text-xs text-muted-foreground">
              Granted once per cycle, on the cycle start day above.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="elEligibilityMonths">Eligibility (months from joining)</Label>
            <Input
              id="elEligibilityMonths"
              name="elEligibilityMonths"
              type="number"
              min={0}
              defaultValue={settings.elEligibilityMonths}
              disabled={!canEdit || pending}
            />
            <p className="text-xs text-muted-foreground">
              An employee starts accruing EL from the first cycle start day on or after this many
              months from their joining date. No EL is backdated for the waiting period.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="elExpiryMonths">Validity of each accrual (months)</Label>
            <Input
              id="elExpiryMonths"
              name="elExpiryMonths"
              type="number"
              min={1}
              defaultValue={settings.elExpiryMonths}
              disabled={!canEdit || pending}
            />
            <p className="text-xs text-muted-foreground">
              Each accrual expires this many months after it was granted if unused. Oldest EL is
              used first when an employee applies for leave, so it naturally expires before newer EL.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="elEncashmentCapDays">Encashment cap at relieving (days)</Label>
            <Input
              id="elEncashmentCapDays"
              name="elEncashmentCapDays"
              type="number"
              step={0.5}
              min={0}
              defaultValue={settings.elEncashmentCapDays}
              disabled={!canEdit || pending}
            />
            <p className="text-xs text-muted-foreground">
              Maximum unused EL that can be paid out when an employee leaves. Policy value only —
              this app does not yet run the actual relieving/payroll encashment calculation.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Casual Leave (CL)"
        description="Annual Casual Leave entitlement. CL never expires and is not affected by these Sick Leave rules."
      >
        <div className="max-w-xs space-y-1">
          <Label htmlFor="clAnnualEntitlement">Annual entitlement (days)</Label>
          <Input
            id="clAnnualEntitlement"
            name="clAnnualEntitlement"
            type="number"
            min={0}
            defaultValue={settings.clAnnualEntitlement}
            disabled={!canEdit || pending}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Sick Leave (SL)"
        description="Annual Sick Leave entitlement and what happens to unused days at year end."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="slAnnualEntitlement">Annual entitlement (days)</Label>
            <Input
              id="slAnnualEntitlement"
              name="slAnnualEntitlement"
              type="number"
              min={0}
              defaultValue={settings.slAnnualEntitlement}
              disabled={!canEdit || pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slCarryForward">Unused Sick Leave</Label>
            <label className="flex items-center gap-2 text-sm">
              <input
                id="slCarryForward"
                name="slCarryForward"
                type="checkbox"
                defaultChecked={settings.slCarryForward}
                onChange={(e) => setSlCarryForward(e.target.checked)}
                disabled={!canEdit || pending}
                className="h-4 w-4 rounded border-input accent-primary disabled:opacity-60"
              />
              Carry forward into the next leave year
            </label>
            <p className="text-xs text-muted-foreground">
              {slCarryForward
                ? "Unused SL rolls into the next leave year (subject to the expiry below, if set)."
                : "Unused SL lapses at the end of each leave year (use-it-or-lose-it)."}
            </p>
          </div>

          {slCarryForward && (
            <div className="space-y-1 sm:col-span-2 sm:max-w-xs">
              <Label htmlFor="slExpiryMonths">Carried-forward SL expires after (months)</Label>
              <Input
                id="slExpiryMonths"
                name="slExpiryMonths"
                type="number"
                min={1}
                defaultValue={settings.slExpiryMonths ?? ""}
                disabled={!canEdit || pending}
              />
              <p className="text-xs text-muted-foreground">Leave blank for no expiry.</p>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Monthly limit & Loss of Pay"
        description="Once an employee's paid leave for the cycle month exceeds this limit, the extra days are Loss of Pay (LOP) — a payroll consequence, never a stored leave balance."
      >
        <div className="max-w-xs space-y-1">
          <Label htmlFor="monthlyLeaveLimit">Maximum paid leave days per month</Label>
          <Input
            id="monthlyLeaveLimit"
            name="monthlyLeaveLimit"
            type="number"
            step={0.5}
            min={0}
            defaultValue={settings.monthlyLeaveLimit}
            disabled={!canEdit || pending}
          />
          <p className="text-xs text-muted-foreground">
            Counted within the leave cycle above (26th–25th). Requests that would exceed this are
            rejected with an explanation rather than silently marked as LOP.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Consecutive leave & advance notice"
        description="Limits applied when an employee submits a leave request."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="maxConsecutiveDays">Maximum consecutive days</Label>
            <Input
              id="maxConsecutiveDays"
              name="maxConsecutiveDays"
              type="number"
              min={1}
              defaultValue={settings.maxConsecutiveDays}
              disabled={!canEdit || pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="advanceNoticeDays">Advance notice required (days)</Label>
            <Input
              id="advanceNoticeDays"
              name="advanceNoticeDays"
              type="number"
              min={0}
              defaultValue={settings.advanceNoticeDays}
              disabled={!canEdit || pending}
            />
            <p className="text-xs text-muted-foreground">
              Applies to planned EL/CL. Sick Leave is exempt (it&apos;s inherently unplanned).
            </p>
          </div>
        </div>
      </SectionCard>

      {canEdit ? (
        <Button type="submit" loading={pending}>
          {pending ? "Saving…" : "Save Leave Settings"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only HR or Super Admin can change Leave Settings. You have view-only access.
        </p>
      )}
    </form>
  );
}
