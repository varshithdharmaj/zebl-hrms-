"use client";

import { useActionState } from "react";
import type { AttendanceOverrideType } from "@/generated/prisma/enums";
import { Trash2, CalendarClock } from "lucide-react";
import {
  updateWeeklyScheduleAction,
  createDateOverrideAction,
  removeDateOverrideAction,
  type AttendanceSettingsActionState,
} from "@/actions/attendance-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";
import { DataTable, DataTableRow, DataTableCell } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { AttendanceSettingsSnapshot } from "@/lib/attendance/attendance-settings";
import { formatDate } from "@/lib/utils";

const initialState: AttendanceSettingsActionState = {};

const WEEKDAYS: { key: keyof AttendanceSettingsSnapshot; label: string }[] = [
  { key: "mondayWorking", label: "Monday" },
  { key: "tuesdayWorking", label: "Tuesday" },
  { key: "wednesdayWorking", label: "Wednesday" },
  { key: "thursdayWorking", label: "Thursday" },
  { key: "fridayWorking", label: "Friday" },
  { key: "saturdayWorking", label: "Saturday" },
  { key: "sundayWorking", label: "Sunday" },
];

type OverrideRow = {
  id: number;
  date: Date;
  type: AttendanceOverrideType;
  reason: string | null;
};

function WeeklyScheduleForm({
  settings,
  canEdit,
}: {
  settings: AttendanceSettingsSnapshot;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateWeeklyScheduleAction, initialState);

  return (
    <SectionCard
      title="Weekly working schedule"
      description="Default classification for each day of the week. Date-specific overrides below always take precedence."
    >
      <form action={formAction} className="space-y-5">
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {WEEKDAYS.map((day) => (
            <label
              key={day.key}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-3 text-center"
            >
              <span className="text-xs font-semibold text-foreground">{day.label}</span>
              <input
                type="checkbox"
                name={day.key}
                defaultChecked={settings[day.key] as boolean}
                disabled={!canEdit || pending}
                className="h-4 w-4 rounded border-input accent-primary disabled:opacity-60"
              />
              <span className="text-[0.6875rem] text-muted-foreground">
                {settings[day.key] ? "Working" : "Off"}
              </span>
            </label>
          ))}
        </div>

        <div className="max-w-xs space-y-1">
          <Label htmlFor="expectedWorkMinutes">Expected work minutes / day</Label>
          <Input
            id="expectedWorkMinutes"
            name="expectedWorkMinutes"
            type="number"
            min={60}
            max={900}
            defaultValue={settings.expectedWorkMinutes}
            disabled={!canEdit || pending}
          />
          <p className="text-xs text-muted-foreground">
            Used only for attendance-day effectiveness (the heatmap) — separate from payroll settings.
          </p>
        </div>

        {canEdit && (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save schedule"}
          </Button>
        )}
        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Only Super Admin can change the weekly schedule. You have view-only access.
          </p>
        )}
      </form>
    </SectionCard>
  );
}

function AddOverrideForm() {
  const [state, formAction, pending] = useActionState(createDateOverrideAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 p-4">
      <div className="space-y-1">
        <Label htmlFor="override-date">Date</Label>
        <Input id="override-date" name="date" type="date" required disabled={pending} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="override-type">Type</Label>
        <select
          id="override-type"
          name="type"
          disabled={pending}
          className="h-9.5 rounded-lg border border-input bg-card px-3 text-sm shadow-subtle"
          defaultValue="working_day"
        >
          <option value="working_day">Working day</option>
          <option value="weekly_off">Weekly off</option>
        </select>
      </div>
      <div className="min-w-[10rem] flex-1 space-y-1">
        <Label htmlFor="override-reason">Reason (optional)</Label>
        <Input id="override-reason" name="reason" placeholder="e.g. Client deliverable" disabled={pending} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add override"}
      </Button>
      {state.error && <p className="w-full text-sm text-danger">{state.error}</p>}
      {state.success && <p className="w-full text-sm font-medium text-success">{state.success}</p>}
    </form>
  );
}

function OverrideRowItem({ override }: { override: OverrideRow }) {
  const [state, formAction, pending] = useActionState(removeDateOverrideAction, initialState);

  return (
    <DataTableRow>
      <DataTableCell className="font-medium whitespace-nowrap">
        {formatDate(override.date)}
      </DataTableCell>
      <DataTableCell>
        {override.type === "working_day" ? "Working day" : "Weekly off"}
      </DataTableCell>
      <DataTableCell className="text-muted-foreground">{override.reason ?? "—"}</DataTableCell>
      <DataTableCell>
        <form action={formAction}>
          <input type="hidden" name="id" value={override.id} />
          <Button type="submit" size="sm" variant="ghost" disabled={pending} aria-label="Remove override">
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </form>
        {state.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
      </DataTableCell>
    </DataTableRow>
  );
}

export function AttendanceSettingsView({
  settings,
  overrides,
  canEdit,
}: {
  settings: AttendanceSettingsSnapshot;
  overrides: OverrideRow[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-8">
      <WeeklyScheduleForm settings={settings} canEdit={canEdit} />

      <SectionCard
        title="Date-specific overrides"
        description="A specific date always overrides the default weekly schedule."
        noPadding
      >
        {canEdit && (
          <div className="border-b border-border p-5">
            <AddOverrideForm />
          </div>
        )}

        {overrides.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={CalendarClock}
              title="No overrides configured"
              description="Date overrides you add will appear here."
            />
          </div>
        ) : (
          <DataTable columns={["Date", "Type", "Reason", canEdit ? "Actions" : ""]}>
            {overrides.map((override) =>
              canEdit ? (
                <OverrideRowItem key={override.id} override={override} />
              ) : (
                <DataTableRow key={override.id}>
                  <DataTableCell className="font-medium whitespace-nowrap">
                    {formatDate(override.date)}
                  </DataTableCell>
                  <DataTableCell>
                    {override.type === "working_day" ? "Working day" : "Weekly off"}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {override.reason ?? "—"}
                  </DataTableCell>
                  <DataTableCell>{null}</DataTableCell>
                </DataTableRow>
              )
            )}
          </DataTable>
        )}
      </SectionCard>
    </div>
  );
}
