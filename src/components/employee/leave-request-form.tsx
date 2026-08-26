"use client";

import { useActionState, useState } from "react";
import { applyLeaveAction, type ActionState } from "@/actions/leaves";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/section-card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from "@/lib/leave-types";

const initialState: ActionState = {};

export function LeaveRequestForm() {
  const [state, formAction, pending] = useActionState(applyLeaveAction, initialState);
  const [leaveType, setLeaveType] = useState("CL");

  return (
    <SectionCard title="Apply for leave" description="EL accrues after 1 year · CL/SL: 12 days per year">
      <form action={formAction} className="max-w-lg space-y-4">
        <input type="hidden" name="leaveType" value={leaveType} />
        {state.error && <ErrorAlert message={state.error} />}
        {state.success && (
          <p className="rounded-lg border border-success/20 bg-success-muted px-4 py-3 text-sm text-success">
            {state.success}
          </p>
        )}
        <div className="space-y-2">
          <Label>Leave type</Label>
          <Select value={leaveType} onValueChange={setLeaveType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAVE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t} — {LEAVE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start</Label>
            <Input id="startDate" name="startDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End</Label>
            <Input id="endDate" name="endDate" type="date" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Textarea id="reason" name="reason" required placeholder="Brief reason" rows={3} />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit request"}
        </Button>
      </form>
    </SectionCard>
  );
}
